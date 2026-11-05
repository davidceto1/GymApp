using PolymarketDashboard.Core.Models;

namespace PolymarketDashboard.Core.Interfaces;

public interface IMarketService
{
    Task<IEnumerable<Market>> GetActiveMarketsAsync();
}
