# Lab 4 - Reference Code (with API Gateway extension)

`ui-service` now acts as both the web UI and the system's API Gateway: it
is the only thing the browser talks to, and it fronts all five backend
services (Product, Customer, Inventory, Payment, Notification), each
guarded by its own independent Circuit Breaker.

No new Go dependencies are required - everything here uses the standard
library plus the `grpc`/`proto` packages you already have. Go generics
(used by `callResilient[T any]`) need Go 1.18+; your `go.mod` already
targets a much newer version, so this just works.

## Files and what to do with each one

| File | Action |
|---|---|
| `ui-service/main.go` | **Replace** your existing `ui-service/main.go` with this one. It now fronts all five services instead of just Product. |
| `ui-service/static/index.html` | **Replace.** Adds a second card, "Place an Order". |
| `ui-service/static/style.css` | **Replace.** Supports the two-card layout. |
| `ui-service/static/app.js` | **Replace.** Handles both forms; product lookup now calls `/api/products/{id}` (path param) instead of `/api/product?id=` (query param). |

None of the five backend services (`product-service`, `customer-service`,
`inventory-service`, `payment-service`, `notification-service`) need any
changes - the gateway only calls their existing public gRPC methods.

If you also have the unit/integration test files from the previous
delivery (`product-service/main_test.go`, `order-service/unit_test.go`,
`order-service/integration_test.go`, and the updated
`order-service/main.go` with `const`→`var`), those are unaffected by this
change and don't need to be touched again.

## Setup

```bash
cd ~/microservices/ecommerce-microservices
cp path/to/lab4_gateway/ui-service/main.go            ui-service/main.go
cp path/to/lab4_gateway/ui-service/static/*           ui-service/static/
go build ./...
```

## Running everything

```bash
# Terminal 1-5: all five backend services
go run ./product-service
go run ./customer-service
go run ./inventory-service
go run ./payment-service
go run ./notification-service

# Terminal 6: the gateway / UI
go run ./ui-service
```

Open **http://localhost:8080**. Two cards:
- **Product Lookup** - enter a product ID (P001-P004), click Search.
- **Place an Order** - enter a Customer ID (C001-C003), a Product ID, and
  a quantity, click Place Order. This calls all five services in
  sequence through the gateway and shows a full summary, including the
  notification messages streamed back from the Notification Service.

## Trying dependency failures through the gateway

Stop any one backend service (e.g. `Ctrl+C` on `payment-service`) and try
placing an order - the gateway will report the failure at the correct
step ("payment") without needing the other four services to be affected,
since each dependency has its own Circuit Breaker. Watch the `ui-service`
terminal for `[CircuitBreaker:Payment] CLOSED -> OPEN` after repeated
failures, and `[Retry:Payment]` lines for each retried attempt.
