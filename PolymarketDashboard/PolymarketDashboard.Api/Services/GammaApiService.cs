using System.Text.Json;
using PolymarketDashboard.Core.Interfaces;
using PolymarketDashboard.Core.Models;

namespace PolymarketDashboard.Api.Services;

public class GammaApiService : IMarketService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<GammaApiService> _logger;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public GammaApiService(HttpClient httpClient, ILogger<GammaApiService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<IEnumerable<Market>> GetActiveMarketsAsync()
    {
        try
        {
            var response = await _httpClient.GetAsync("/markets?closed=false&limit=50");
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            var markets = JsonSerializer.Deserialize<List<Market>>(json, _jsonOptions);

            return markets ?? [];
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch markets from Gamma API");
            return [];
        }
    }
}
