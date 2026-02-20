using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using PolymarketDashboard.Core.Interfaces;
using PolymarketDashboard.Core.Models;

namespace PolymarketDashboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MarketsController : ControllerBase
{
    private readonly IMarketService _marketService;
    private readonly IMemoryCache _cache;
    private readonly ILogger<MarketsController> _logger;

    private const string CacheKey = "active_markets";
    private static readonly TimeSpan CacheExpiry = TimeSpan.FromSeconds(30);

    public MarketsController(
        IMarketService marketService,
        IMemoryCache cache,
        ILogger<MarketsController> logger)
    {
        _marketService = marketService;
        _cache = cache;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Market>>> GetMarkets()
    {
        if (_cache.TryGetValue(CacheKey, out IEnumerable<Market>? cachedMarkets) && cachedMarkets is not null)
        {
            _logger.LogDebug("Returning markets from cache");
            return Ok(cachedMarkets);
        }

        var markets = await _marketService.GetActiveMarketsAsync();

        _cache.Set(CacheKey, markets, CacheExpiry);

        return Ok(markets);
    }
}
