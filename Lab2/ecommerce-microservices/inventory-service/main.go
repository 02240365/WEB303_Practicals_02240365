package main

import (
	"context"
	"log"
	"net"
	"sync"

	pb "ecommerce-microservices/proto"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/status"
)

// server implements the generated InventoryServiceServer interface.
// A mutex guards the in-memory stock map since gRPC handles requests
// concurrently on separate goroutines.
type server struct {
	pb.UnimplementedInventoryServiceServer
	mu    sync.Mutex
	stock map[string]int32
}

// CheckStock returns how many units of a product are currently available.
func (s *server) CheckStock(ctx context.Context, req *pb.StockRequest) (*pb.StockResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	qty, ok := s.stock[req.GetProductId()]
	if !ok {
		return nil, status.Errorf(codes.NotFound, "no inventory record for product %s", req.GetProductId())
	}

	return &pb.StockResponse{ProductId: req.GetProductId(), Quantity: qty}, nil
}

// DecreaseStock reserves units of a product for an order.
//   - Returns codes.NotFound if the product has no inventory record.
//   - Returns codes.InvalidArgument if the requested quantity is not positive.
//   - Returns codes.FailedPrecondition if there is not enough stock left.
func (s *server) DecreaseStock(ctx context.Context, req *pb.DecreaseStockRequest) (*pb.StockResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	qty, ok := s.stock[req.GetProductId()]
	if !ok {
		return nil, status.Errorf(codes.NotFound, "no inventory record for product %s", req.GetProductId())
	}
	if req.GetQuantity() <= 0 {
		return nil, status.Error(codes.InvalidArgument, "quantity must be greater than zero")
	}
	if qty < req.GetQuantity() {
		return nil, status.Errorf(codes.FailedPrecondition,
			"insufficient stock for product %s: have %d, requested %d", req.GetProductId(), qty, req.GetQuantity())
	}

	s.stock[req.GetProductId()] = qty - req.GetQuantity()
	return &pb.StockResponse{ProductId: req.GetProductId(), Quantity: s.stock[req.GetProductId()]}, nil
}

func main() {
	lis, err := net.Listen("tcp", ":50052")
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	// Seed initial stock levels matching the Part A product catalogue.
	stock := map[string]int32{
		"P001": 10, // Laptop
		"P002": 25, // Mechanical Keyboard
		"P003": 40, // Wireless Mouse
		"P004": 15, // Monitor
	}

	grpcServer := grpc.NewServer()
	pb.RegisterInventoryServiceServer(grpcServer, &server{stock: stock})

	// Reflection lets tools like grpcurl discover this service's methods
	// (list / describe) without needing the .proto file at hand.
	reflection.Register(grpcServer)

	log.Println("Inventory Service is running on port 50052...")
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
