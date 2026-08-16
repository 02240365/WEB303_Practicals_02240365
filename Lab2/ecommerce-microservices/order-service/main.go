package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"time"

	pb "ecommerce-microservices/proto"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	if os.Args[1] == "place" {
		// Part B: go run ./order-service place <customer_id> <product_id> <quantity>
		if len(os.Args) != 5 {
			printUsage()
			os.Exit(1)
		}
		placeOrder(os.Args[2], os.Args[3], os.Args[4])
		return
	}

	// Part A (kept working): go run ./order-service <product_id>
	getProduct(os.Args[1])
}

func printUsage() {
	fmt.Println("Usage:")
	fmt.Println("  go run ./order-service <product_id>")
	fmt.Println("      Part A - fetch a single product from the Product Service")
	fmt.Println("  go run ./order-service place <customer_id> <product_id> <quantity>")
	fmt.Println("      Part B - place a full order across all microservices")
}

// connect opens an insecure (no TLS) gRPC connection to the given address.
// Insecure credentials are fine here because everything runs on localhost.
func connect(address string) *grpc.ClientConn {
	conn, err := grpc.Dial(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to connect to %s: %v", address, err)
	}
	return conn
}

// getProduct reproduces the original Part A behaviour: look up a single
// product from the Product Service and print its details.
func getProduct(productID string) {
	conn := connect("localhost:50051")
	defer conn.Close()

	client := pb.NewProductServiceClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	product, err := client.GetProduct(ctx, &pb.GetProductRequest{ProductId: productID})
	if err != nil {
		st, _ := status.FromError(err)
		fmt.Printf("Error fetching product: %s\n", st.Message())
		return
	}

	fmt.Println("Product ID:", product.GetProductId())
	fmt.Println("Name:", product.GetName())
	fmt.Println("Price:", product.GetPrice())
}

// placeOrder is the Part B workflow. The Order Service acts as an
// orchestrator, calling all five microservices in sequence to simulate
// a real order being placed:
//
//  1. Customer Service     - verify the customer exists          (unary RPC)
//  2. Product Service      - fetch product details and price     (unary RPC)
//  3. Inventory Service    - check and reserve stock              (unary RPC)
//  4. Payment Service      - charge the customer                 (unary RPC)
//  5. Notification Service - stream order status updates back    (server-streaming RPC)
//
// If any step fails, the gRPC status code and message returned by that
// service are surfaced to the user and the order stops there.
func placeOrder(customerID, productID, quantityStr string) {
	var quantity int32
	if _, err := fmt.Sscanf(quantityStr, "%d", &quantity); err != nil || quantity <= 0 {
		fmt.Println("Error: quantity must be a positive whole number")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// --- Step 1: Customer Service ---
	custConn := connect("localhost:50053")
	defer custConn.Close()
	custClient := pb.NewCustomerServiceClient(custConn)

	customer, err := custClient.GetCustomer(ctx, &pb.GetCustomerRequest{CustomerId: customerID})
	if err != nil {
		st, _ := status.FromError(err)
		fmt.Printf("Customer check failed: %s\n", st.Message())
		return
	}
	fmt.Printf("Step 1/5 - Customer verified: %s (%s)\n", customer.GetName(), customer.GetEmail())

	// --- Step 2: Product Service ---
	prodConn := connect("localhost:50051")
	defer prodConn.Close()
	prodClient := pb.NewProductServiceClient(prodConn)

	product, err := prodClient.GetProduct(ctx, &pb.GetProductRequest{ProductId: productID})
	if err != nil {
		st, _ := status.FromError(err)
		fmt.Printf("Product lookup failed: %s\n", st.Message())
		return
	}
	fmt.Printf("Step 2/5 - Product found: %s (Nu. %.2f each)\n", product.GetName(), product.GetPrice())

	// --- Step 3: Inventory Service ---
	invConn := connect("localhost:50052")
	defer invConn.Close()
	invClient := pb.NewInventoryServiceClient(invConn)

	stock, err := invClient.DecreaseStock(ctx, &pb.DecreaseStockRequest{ProductId: productID, Quantity: quantity})
	if err != nil {
		st, _ := status.FromError(err)
		fmt.Printf("Inventory update failed: %s\n", st.Message())
		return
	}
	fmt.Printf("Step 3/5 - Stock reserved. Remaining stock for %s: %d\n", productID, stock.GetQuantity())

	// --- Step 4: Payment Service ---
	payConn := connect("localhost:50054")
	defer payConn.Close()
	payClient := pb.NewPaymentServiceClient(payConn)

	totalAmount := product.GetPrice() * float64(quantity)
	orderID := fmt.Sprintf("ORD-%s-%s", customerID, productID)

	payment, err := payClient.ProcessPayment(ctx, &pb.PaymentRequest{
		OrderId:    orderID,
		CustomerId: customerID,
		Amount:     totalAmount,
	})
	if err != nil {
		st, _ := status.FromError(err)
		fmt.Printf("Payment failed: %s\n", st.Message())
		return
	}
	fmt.Printf("Step 4/5 - Payment successful. Payment ID: %s | Amount charged: Nu. %.2f\n", payment.GetPaymentId(), totalAmount)

	// --- Step 5: Notification Service (server-streaming RPC) ---
	notifConn := connect("localhost:50055")
	defer notifConn.Close()
	notifClient := pb.NewNotificationServiceClient(notifConn)

	// Use a fresh, longer-lived context for the stream since it takes a
	// few seconds to receive all the notification messages.
	streamCtx, streamCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer streamCancel()

	stream, err := notifClient.SubscribeNotifications(streamCtx, &pb.SubscribeRequest{
		CustomerId: customerID,
		OrderId:    orderID,
	})
	if err != nil {
		st, _ := status.FromError(err)
		fmt.Printf("Could not subscribe to notifications: %s\n", st.Message())
		return
	}

	fmt.Println("Step 5/5 - Order status updates:")
	for {
		notification, err := stream.Recv()
		if err == io.EOF {
			break // server closed the stream normally
		}
		if err != nil {
			st, _ := status.FromError(err)
			fmt.Printf("Notification stream error: %s\n", st.Message())
			break
		}
		fmt.Printf("  [%s] %s\n", notification.GetTimestamp(), notification.GetMessage())
	}

	fmt.Printf("\nOrder %s completed successfully.\n", orderID)
}
