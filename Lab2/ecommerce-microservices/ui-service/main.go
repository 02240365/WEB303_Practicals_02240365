package main

// =====================================================================
// Lab 4, Part A - UI Service, extended into an API Gateway
// =====================================================================
//
// This service now does two jobs:
//
//  1. Serves the web UI (static/index.html, style.css, app.js).
//  2. Acts as the system's API Gateway: it is the ONLY thing the browser
//     talks to. Every one of the five backend gRPC services (Product,
//     Customer, Inventory, Payment, Notification) is only ever reached
//     through this gateway - the browser never dials gRPC directly, and
//     the gateway never reads any service's data store directly either.
//
// Each downstream dependency gets its OWN circuit breaker, tracked
// independently - the Payment Service being down should not trip the
// breaker guarding the Product Service, for example. All five go through
// the same generic, resilient call helper (callResilient), which applies
// the same Timeout + Retry + Circuit Breaker approach used in Lab 3,
// just written once and reused instead of copy-pasted five times.
//
// REST surface exposed to the browser:
//   GET  /api/products/{id}   - look up a single product
//   POST /api/orders          - place an order (orchestrates all five services)
//
// Run with:  go run ./ui-service            (from the project root)
// Then open: http://localhost:8080
// =====================================================================

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	pb "ecommerce-microservices/proto"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
)

// Addresses of the five backend services this gateway fronts.
const (
	productServiceAddr      = "localhost:50051"
	inventoryServiceAddr    = "localhost:50052"
	customerServiceAddr     = "localhost:50053"
	paymentServiceAddr      = "localhost:50054"
	notificationServiceAddr = "localhost:50055"
)

// Tunable timings for the gateway's resilient calls. Kept short since a
// person is waiting on the other end of a browser request - unlike the
// order-service CLI demo (Lab 3), which uses long, human-scale delays.
var (
	gwCallTimeout  = 2 * time.Second
	gwMaxRetries   = 2
	gwRetryBackoff = 500 * time.Millisecond
)

// ---------------------------------------------------------------------
// Circuit Breaker (same CLOSED / OPEN / HALF_OPEN design as order-service)
// ---------------------------------------------------------------------

type circuitState string

const (
	stateClosed   circuitState = "CLOSED"
	stateOpen     circuitState = "OPEN"
	stateHalfOpen circuitState = "HALF_OPEN"
)

type circuitBreaker struct {
	mu               sync.Mutex
	name             string
	state            circuitState
	failureCount     int
	failureThreshold int
	openTimeout      time.Duration
	lastFailureTime  time.Time
}

func newCircuitBreaker(name string, threshold int, openTimeout time.Duration) *circuitBreaker {
	return &circuitBreaker{name: name, state: stateClosed, failureThreshold: threshold, openTimeout: openTimeout}
}

func (cb *circuitBreaker) setState(s circuitState) {
	if cb.state != s {
		log.Printf("[CircuitBreaker:%s] %s -> %s", cb.name, cb.state, s)
		cb.state = s
	}
}

func (cb *circuitBreaker) allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	if cb.state == stateOpen {
		if time.Since(cb.lastFailureTime) >= cb.openTimeout {
			cb.setState(stateHalfOpen)
			return true
		}
		return false
	}
	return true
}

func (cb *circuitBreaker) recordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.failureCount = 0
	if cb.state == stateHalfOpen {
		cb.setState(stateClosed)
	}
}

func (cb *circuitBreaker) recordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.lastFailureTime = time.Now()
	if cb.state == stateHalfOpen {
		cb.setState(stateOpen)
		return
	}
	cb.failureCount++
	if cb.failureCount >= cb.failureThreshold {
		cb.setState(stateOpen)
	}
}

// One breaker per downstream dependency, so a failure in one service
// never affects how the gateway treats another.
var (
	productBreaker      = newCircuitBreaker("Product", 3, 8*time.Second)
	customerBreaker     = newCircuitBreaker("Customer", 3, 8*time.Second)
	inventoryBreaker    = newCircuitBreaker("Inventory", 3, 8*time.Second)
	paymentBreaker      = newCircuitBreaker("Payment", 3, 8*time.Second)
	notificationBreaker = newCircuitBreaker("Notification", 3, 8*time.Second)
)

// ---------------------------------------------------------------------
// Shared resilient call helper (Timeout + Retry + Circuit Breaker)
// ---------------------------------------------------------------------

// callResilient wraps a single downstream gRPC call with all three Lab 3
// patterns: the breaker decides whether to attempt the call at all; each
// attempt is bounded by gwCallTimeout; failed attempts are retried with a
// short backoff. NotFound / InvalidArgument / FailedPrecondition are
// treated as the dependency working correctly and just reporting a
// business-level outcome, so they are returned immediately without being
// retried or counted as a breaker failure.
func callResilient[T any](breaker *circuitBreaker, fn func(ctx context.Context) (T, error)) (T, error) {
	var zero T

	if !breaker.allow() {
		return zero, status.Error(codes.Unavailable, "circuit breaker is open - dependency assumed unavailable")
	}

	var lastErr error
	for attempt := 1; attempt <= gwMaxRetries; attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), gwCallTimeout)
		result, err := fn(ctx)
		cancel()

		if err == nil {
			breaker.recordSuccess()
			return result, nil
		}

		st, _ := status.FromError(err)
		switch st.Code() {
		case codes.NotFound, codes.InvalidArgument, codes.FailedPrecondition:
			return zero, err
		}

		lastErr = err
		log.Printf("[Retry:%s] attempt %d/%d failed: %s", breaker.name, attempt, gwMaxRetries, st.Message())
		if attempt < gwMaxRetries {
			time.Sleep(gwRetryBackoff)
		}
	}

	breaker.recordFailure()
	return zero, lastErr
}

// ---------------------------------------------------------------------
// Per-service gateway clients, backed by callResilient
// ---------------------------------------------------------------------

type gatewayClients struct {
	product      pb.ProductServiceClient
	customer     pb.CustomerServiceClient
	inventory    pb.InventoryServiceClient
	payment      pb.PaymentServiceClient
	notification pb.NotificationServiceClient
}

func (g *gatewayClients) getProduct(id string) (*pb.Product, error) {
	return callResilient(productBreaker, func(ctx context.Context) (*pb.Product, error) {
		return g.product.GetProduct(ctx, &pb.GetProductRequest{ProductId: id})
	})
}

func (g *gatewayClients) getCustomer(id string) (*pb.Customer, error) {
	return callResilient(customerBreaker, func(ctx context.Context) (*pb.Customer, error) {
		return g.customer.GetCustomer(ctx, &pb.GetCustomerRequest{CustomerId: id})
	})
}

func (g *gatewayClients) decreaseStock(productID string, qty int32) (*pb.StockResponse, error) {
	return callResilient(inventoryBreaker, func(ctx context.Context) (*pb.StockResponse, error) {
		return g.inventory.DecreaseStock(ctx, &pb.DecreaseStockRequest{ProductId: productID, Quantity: qty})
	})
}

func (g *gatewayClients) processPayment(orderID, customerID string, amount float64) (*pb.PaymentResponse, error) {
	return callResilient(paymentBreaker, func(ctx context.Context) (*pb.PaymentResponse, error) {
		return g.payment.ProcessPayment(ctx, &pb.PaymentRequest{OrderId: orderID, CustomerId: customerID, Amount: amount})
	})
}

// collectNotifications reads every message off the server-streaming
// SubscribeNotifications call and returns them as a plain slice, since a
// simple JSON REST response can't stream the way gRPC can. A single
// timeout bounds the whole subscription (no retry/breaker here - a
// notification feed failing outright doesn't block the order, which has
// already succeeded by the time this runs).
func (g *gatewayClients) collectNotifications(customerID, orderID string) ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	stream, err := g.notification.SubscribeNotifications(ctx, &pb.SubscribeRequest{CustomerId: customerID, OrderId: orderID})
	if err != nil {
		notificationBreaker.recordFailure()
		return nil, err
	}

	var messages []string
	for {
		notification, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			notificationBreaker.recordFailure()
			return messages, err
		}
		messages = append(messages, fmt.Sprintf("[%s] %s", notification.GetTimestamp(), notification.GetMessage()))
	}
	notificationBreaker.recordSuccess()
	return messages, nil
}

// ---------------------------------------------------------------------
// HTTP layer: /api/products/{id}
// ---------------------------------------------------------------------

type productResponse struct {
	Found     bool    `json:"found"`
	ProductID string  `json:"productId,omitempty"`
	Name      string  `json:"name,omitempty"`
	Price     float64 `json:"price,omitempty"`
	ErrorCode string  `json:"errorCode,omitempty"`
	Message   string  `json:"message,omitempty"`
}

// catalogProductIDs is the set of product IDs the storefront grid
// displays. ProductService only exposes a single-item GetProduct lookup
// (no ListProducts RPC), so the gateway aggregates the catalog itself by
// calling GetProduct once per known ID. If your Product Service's sample
// data uses different IDs, update this list to match.
var catalogProductIDs = []string{"P001", "P002", "P003", "P004"}

type catalogResponse struct {
	Products []productResponse `json:"products"`
}

// productsListHandler backs GET /api/products (no id): it looks up every
// ID in catalogProductIDs through the same resilient client used for a
// single lookup, and returns whichever ones succeeded. A product that
// fails (e.g. a transient dependency error) is simply left out of the
// response rather than failing the whole page - the storefront shows a
// partial catalog instead of an empty one.
func productsListHandler(g *gatewayClients) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var results []productResponse
		for _, id := range catalogProductIDs {
			product, err := g.getProduct(id)
			if err != nil {
				log.Printf("catalog: skipping %s: %v", id, err)
				continue
			}
			results = append(results, productResponse{
				Found: true, ProductID: product.GetProductId(), Name: product.GetName(), Price: product.GetPrice(),
			})
		}
		writeJSON(w, http.StatusOK, catalogResponse{Products: results})
	}
}

func writeJSON(w http.ResponseWriter, statusCode int, body interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(body)
}

// dependencyErrorCode maps a gRPC status code to the small set of error
// codes the front-end understands, so every endpoint reports failures
// the same way.
func dependencyErrorCode(err error) (httpStatus int, code, fallbackMessage string) {
	st, _ := status.FromError(err)
	switch st.Code() {
	case codes.NotFound:
		return http.StatusNotFound, "not_found", "The requested record does not exist."
	case codes.InvalidArgument:
		return http.StatusBadRequest, "invalid_input", "Please check your input and try again."
	case codes.FailedPrecondition:
		return http.StatusConflict, "failed_precondition", st.Message()
	default:
		return http.StatusServiceUnavailable, "unavailable", "A dependent service is currently unavailable. Please try again shortly."
	}
}

func productHandler(g *gatewayClients) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/api/products/")
		if id == "" {
			id = r.URL.Query().Get("id")
		}
		if id == "" {
			writeJSON(w, http.StatusBadRequest, productResponse{Found: false, ErrorCode: "invalid_input", Message: "Please enter a product ID."})
			return
		}

		product, err := g.getProduct(id)
		if err != nil {
			httpStatus, code, msg := dependencyErrorCode(err)
			if code == "not_found" {
				msg = fmt.Sprintf("Product '%s' does not exist.", id)
			}
			writeJSON(w, httpStatus, productResponse{Found: false, ErrorCode: code, Message: msg})
			return
		}

		writeJSON(w, http.StatusOK, productResponse{
			Found: true, ProductID: product.GetProductId(), Name: product.GetName(), Price: product.GetPrice(),
		})
	}
}

// ---------------------------------------------------------------------
// HTTP layer: POST /api/orders
// ---------------------------------------------------------------------

type orderRequest struct {
	CustomerID string `json:"customerId"`
	ProductID  string `json:"productId"`
	Quantity   int32  `json:"quantity"`
}

type orderResponse struct {
	Success        bool     `json:"success"`
	Step           string   `json:"step,omitempty"` // which step failed, if any
	ErrorCode      string   `json:"errorCode,omitempty"`
	Message        string   `json:"message,omitempty"`
	OrderID        string   `json:"orderId,omitempty"`
	CustomerName   string   `json:"customerName,omitempty"`
	ProductName    string   `json:"productName,omitempty"`
	UnitPrice      float64  `json:"unitPrice,omitempty"`
	TotalAmount    float64  `json:"totalAmount,omitempty"`
	RemainingStock int32    `json:"remainingStock,omitempty"`
	PaymentID      string   `json:"paymentId,omitempty"`
	Notifications  []string `json:"notifications,omitempty"`
}

// orderHandler orchestrates the same five-step flow as order-service's
// placeOrder (Lab 2/3), but through the gateway's resilient clients, and
// returns one JSON summary instead of printing to a terminal.
func orderHandler(g *gatewayClients) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, orderResponse{Success: false, ErrorCode: "invalid_input", Message: "Use POST to place an order."})
			return
		}

		var req orderRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, orderResponse{Success: false, ErrorCode: "invalid_input", Message: "Malformed request body."})
			return
		}
		if req.CustomerID == "" || req.ProductID == "" || req.Quantity <= 0 {
			writeJSON(w, http.StatusBadRequest, orderResponse{
				Success: false, ErrorCode: "invalid_input",
				Message: "Please provide a customer ID, a product ID, and a quantity greater than zero.",
			})
			return
		}

		// Step 1/5 - Customer Service
		customer, err := g.getCustomer(req.CustomerID)
		if err != nil {
			httpStatus, code, msg := dependencyErrorCode(err)
			if code == "not_found" {
				msg = fmt.Sprintf("Customer '%s' does not exist.", req.CustomerID)
			}
			writeJSON(w, httpStatus, orderResponse{Success: false, Step: "customer", ErrorCode: code, Message: msg})
			return
		}

		// Step 2/5 - Product Service
		product, err := g.getProduct(req.ProductID)
		if err != nil {
			httpStatus, code, msg := dependencyErrorCode(err)
			if code == "not_found" {
				msg = fmt.Sprintf("Product '%s' does not exist.", req.ProductID)
			}
			writeJSON(w, httpStatus, orderResponse{Success: false, Step: "product", ErrorCode: code, Message: msg})
			return
		}

		// Step 3/5 - Inventory Service
		stock, err := g.decreaseStock(req.ProductID, req.Quantity)
		if err != nil {
			httpStatus, code, msg := dependencyErrorCode(err)
			writeJSON(w, httpStatus, orderResponse{Success: false, Step: "inventory", ErrorCode: code, Message: msg})
			return
		}

		// Step 4/5 - Payment Service
		orderID := fmt.Sprintf("ORD-%s-%s", req.CustomerID, req.ProductID)
		totalAmount := product.GetPrice() * float64(req.Quantity)
		payment, err := g.processPayment(orderID, req.CustomerID, totalAmount)
		if err != nil {
			httpStatus, code, msg := dependencyErrorCode(err)
			writeJSON(w, httpStatus, orderResponse{Success: false, Step: "payment", ErrorCode: code, Message: msg})
			return
		}

		// Step 5/5 - Notification Service (best-effort; the order itself
		// has already succeeded by this point)
		notifications, notifErr := g.collectNotifications(req.CustomerID, orderID)
		if notifErr != nil {
			log.Printf("notification stream ended early: %v", notifErr)
		}

		writeJSON(w, http.StatusOK, orderResponse{
			Success: true, OrderID: orderID,
			CustomerName: customer.GetName(), ProductName: product.GetName(),
			UnitPrice: product.GetPrice(), TotalAmount: totalAmount,
			RemainingStock: stock.GetQuantity(), PaymentID: payment.GetPaymentId(),
			Notifications: notifications,
		})
	}
}

// ---------------------------------------------------------------------

func mustDial(address string) *grpc.ClientConn {
	conn, err := grpc.Dial(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to connect to %s: %v", address, err)
	}
	return conn
}

func main() {
	productConn := mustDial(productServiceAddr)
	defer productConn.Close()
	customerConn := mustDial(customerServiceAddr)
	defer customerConn.Close()
	inventoryConn := mustDial(inventoryServiceAddr)
	defer inventoryConn.Close()
	paymentConn := mustDial(paymentServiceAddr)
	defer paymentConn.Close()
	notificationConn := mustDial(notificationServiceAddr)
	defer notificationConn.Close()

	gateway := &gatewayClients{
		product:      pb.NewProductServiceClient(productConn),
		customer:     pb.NewCustomerServiceClient(customerConn),
		inventory:    pb.NewInventoryServiceClient(inventoryConn),
		payment:      pb.NewPaymentServiceClient(paymentConn),
		notification: pb.NewNotificationServiceClient(notificationConn),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/products", productsListHandler(gateway)) // exact match: GET /api/products (catalog)
	mux.HandleFunc("/api/products/", productHandler(gateway))     // subtree: GET /api/products/{id}
	mux.HandleFunc("/api/orders", orderHandler(gateway))
	mux.Handle("/", http.FileServer(http.Dir("ui-service/static")))

	const addr = ":8080"
	log.Printf("Gateway / UI Service running at http://localhost%s", addr)
	log.Printf("Fronting: Product(%s) Customer(%s) Inventory(%s) Payment(%s) Notification(%s)",
		productServiceAddr, customerServiceAddr, inventoryServiceAddr, paymentServiceAddr, notificationServiceAddr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
