# Polymarket Dashboard

A real-time dashboard displaying active prediction markets from [Polymarket](https://polymarket.com), built with ASP.NET Core (.NET 8).

## Architecture

```
PolymarketDashboard/
├── PolymarketDashboard.sln
├── PolymarketDashboard.Core/          # Models and service interfaces
│   ├── Models/
│   │   └── Market.cs
│   └── Interfaces/
│       └── IMarketService.cs
├── PolymarketDashboard.Api/           # ASP.NET Core Web API
│   ├── Controllers/
│   │   └── MarketsController.cs      # GET /api/markets
│   ├── Services/
│   │   └── GammaApiService.cs        # Typed HttpClient for Gamma API
│   ├── wwwroot/
│   │   └── index.html                # Single-page frontend
│   └── Program.cs
└── README.md
```

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8)

Verify your installation:

```bash
dotnet --version
# should print 8.x.x
```

## Running the project

```bash
# From the solution root
cd PolymarketDashboard

# Restore packages and run the API
dotnet run --project PolymarketDashboard.Api
```

The app starts on `http://localhost:5000` (or `https://localhost:7000`). Open the URL in your browser — `index.html` is served automatically at the root.

### API endpoint

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/markets` | Returns up to 50 active markets (cached 30 s) |

## Features

- **Backend**
  - Fetches active markets from the Polymarket Gamma API (`https://gamma-api.polymarket.com/markets?closed=false&limit=50`)
  - Typed `HttpClient` registered via DI (`GammaApiService`)
  - `IMemoryCache` caching with a 30-second expiry to avoid hammering the upstream API
  - CORS enabled for `localhost` origins during development
  - Static file serving so `index.html` is reachable at `/`

- **Frontend** (plain HTML/CSS/JS, no frameworks)
  - Responsive CSS grid of market cards
  - Each card shows: question, YES/NO outcome prices, volume, liquidity, end date, and status
  - Live search bar filters cards by question text
  - Dark theme with loading skeletons and error/retry states

## Data source

Markets are fetched from the Polymarket **Gamma API** (public, no auth required):

```
GET https://gamma-api.polymarket.com/markets?closed=false&limit=50
```

Fields used: `id`, `question`, `endDate`, `volume`, `liquidity`, `outcomePrices`, `outcomes`, `active`, `closed`.
