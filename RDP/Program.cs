var builder = WebApplication.CreateBuilder(args);
var BlazorAppBaseUrl = builder.Configuration["ASPNETCORE_URLS"]?.Split(';').FirstOrDefault()
                       ?? "https://localhost:7156";


builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();

builder.Services.AddHttpClient("GuacamoleAPI"); 

builder.Services.AddScoped<RDPApp.Services.GuacamoleService>();

builder.Services.AddScoped<RDPApp.Services.UserSession>();

builder.Services.AddScoped(sp => new HttpClient
{
    // Blazor uygulamasýnýn kendisinin base adresini atýyoruz
    BaseAddress = new Uri(BlazorAppBaseUrl)
});

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.MapControllers();
app.MapBlazorHub();
app.MapFallbackToPage("/_Host");

app.Run();
