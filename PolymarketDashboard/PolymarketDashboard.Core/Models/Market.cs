namespace PolymarketDashboard.Core.Models;

public class Market
{
    public string Id { get; set; } = string.Empty;
    public string Question { get; set; } = string.Empty;
    public DateTime? EndDate { get; set; }
    public decimal Volume { get; set; }
    public decimal Liquidity { get; set; }
    public string[]? OutcomePrices { get; set; }
    public string[]? Outcomes { get; set; }
    public bool Active { get; set; }
    public bool Closed { get; set; }
}
