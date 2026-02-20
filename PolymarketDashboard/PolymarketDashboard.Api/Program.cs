using PolymarketDashboard.Api.Services;
using PolymarketDashboard.Core.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers();
builder.Services.AddMemoryCache();

// Register Gamma API typed HttpClient
builder.Services.AddHttpClient<IMarketService, GammaApiService>(client =>
{
    client.BaseAddress = new Uri("https://gamma-api.polymarket.com");
    client.DefaultRequestHeaders.Add("Accept", "application/json");
    client.Timeout = TimeSpan.FromSeconds(15);
});

// CORS for localhost development
builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalDev", policy =>
    {
        policy.WithOrigins(
                "http://localhost:3000",
                "http://localhost:5000",
                "http://localhost:5173",
                "https://localhost:7000")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors("LocalDev");

// Serve static files (index.html from wwwroot)
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthorization();
app.MapControllers();

app.Run();
