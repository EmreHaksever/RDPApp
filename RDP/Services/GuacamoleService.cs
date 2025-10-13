//GuacamoleService.cs

using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace RDPApp.Services
{
    public record GuacLoginResponse(string authToken);
    public record GuacConnectionResponse(string identifier);
    public record GuacTunnelResponse(string tunnelId, string connectionId);

    public class GuacamoleService
    {
        private const string GuacApiBaseUrl = "http://localhost:8080/api/";
        private readonly IHttpClientFactory _httpClientFactory;

        public GuacamoleService(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        private HttpClient CreateGuacClient()
        {
            var client = _httpClientFactory.CreateClient("GuacamoleAPI");
            client.BaseAddress = new Uri(GuacApiBaseUrl);
            return client;
        }

        public async Task<string?> GetAuthTokenAsync(string username, string password)
        {
            var client = CreateGuacClient();
            var formData = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("username", username),
                new KeyValuePair<string, string>("password", password)
            });

            try
            {
                var response = await client.PostAsync("tokens", formData);
                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"Token Alma Başarısız: {response.StatusCode}");
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                return doc.RootElement.GetProperty("authToken").GetString();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Token Alma Sırasında Hata: {ex.Message}");
                return null;
            }
        }

        public async Task<string?> CreateConnectionAsync(string authToken, string host, string username, string password)
        {
            var client = CreateGuacClient();

            // 1. RDP Bağlantı Parametreleri (Dictionary kullanılıyor)
            var parameters = new Dictionary<string, string>
            {
                {"hostname", host},
                {"port", "3389"},
                {"username", username},
                {"password", password},
                
                // KRİTİK ÇÖZÜM: Sertifika ve NLA Hatalarını Atlatma
                {"ignore-cert", "true"},
                {"security", "any"},
                //{"disable-auth", "true"},
                
                // YENİ ÇÖZÜM: Bağlantı Zaman Aşımı Sürelerini Artırma (Saniye cinsinden)
                {"timeout", "15000"}, // 15 saniye bağlantı kurma süresi
                {"read-timeout", "20000"} // 20 saniye veri okuma süresi
            };

            // 2. Zorunlu API Nesnesi (NPE hatalarını önler)
            var connectionData = new
            {
                name = $"RemoteSession-{Guid.NewGuid().ToString().Substring(0, 4)}",
                protocol = "rdp",
                parentIdentifier = "ROOT",
                type = "ORGANIZATIONAL",
                attributes = new Dictionary<string, string>(),
                parameters = parameters
            };

            var json = JsonSerializer.Serialize(connectionData);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var url = $"session/data/mysql/connections?token={authToken}";

            try
            {
                var response = await client.PostAsync(url, content);

                if (!response.IsSuccessStatusCode)
                {
                    string errorContent = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"Guacamole Bağlantı Oluşturma Başarısız: {response.StatusCode}");
                    Console.WriteLine($"Guacamole Hata Detayı: {errorContent}");
                    return null;
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<GuacConnectionResponse>(responseJson);

                return data?.identifier;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Bağlantı Oluşturma Sırasında Hata: {ex.Message}");
                return null;
            }
        }

        public async Task<string?> GetTunnelKeyAsync(string authToken, string connectionId)
        {
            var client = CreateGuacClient();

            var url = $"session/data/mysql/connections/{connectionId}/tunnels?token={authToken}";

            try
            {
                var response = await client.PostAsync(url, null);

                if (!response.IsSuccessStatusCode)
                {
                    // Bağlantı başarılı olsa bile guacd ile RDP makinesi arasındaki sorun burada yakalanır.
                    string errorContent = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"Tünel Anahtarı Alma Başarısız: {response.StatusCode}");
                    Console.WriteLine($"Guacamole Hata Detayı: {errorContent}");
                    return null;
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<GuacTunnelResponse>(responseJson);

                return data?.tunnelId;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Tünel Anahtarı Alma Sırasında Hata: {ex.Message}");
                return null;
            }
        }
    }
}
