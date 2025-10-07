var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();

// HttpClient BaseAddress ayarý
builder.Services.AddHttpClient("ServerAPI", client =>
{
    client.BaseAddress = new Uri("https://localhost:7156/"); // Blazor portun
});
builder.Services.AddScoped(sp => sp.GetRequiredService<IHttpClientFactory>().CreateClient("ServerAPI"));

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
