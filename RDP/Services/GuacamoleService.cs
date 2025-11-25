using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.Extensions.Configuration; // Configuration için gerekli

namespace RDPApp.Services
{
    // Login ve Bağlantı yanıtları için mevcut recordlar
    public record GuacLoginResponse(string authToken);
    public record GuacConnectionResponse(string identifier);
    public record GuacTunnelResponse(string tunnelId, string connectionId);

    // YENİ: Bağlantı listesi için model
    public class GuacConnectionDetail
    {
        public string Identifier { get; set; }
        public string Name { get; set; }
        public string Protocol { get; set; }
    }

    public class GuacamoleService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration; // Yapılandırma servisi

        public GuacamoleService(IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
        }

        // =========================================================================
        // AYARLAR: Değerler artık appsettings.json veya User Secrets'tan okunuyor
        // =========================================================================
        private string ApiUrl => _configuration["Guacamole:ApiUrl"] ?? "http://localhost:8080/api/";

        // DataSource ayarını da config'den okuyoruz, yoksa varsayılan 'mysql'
        private string DataSource => _configuration["Guacamole:DataSource"] ?? "mysql";

        private string MasterUser => _configuration["Guacamole:MasterUser"] ?? "admin";

        // ŞİFRE ARTIK KODDA YOK! Güvenli alandan okunuyor.
        private string MasterPass => _configuration["Guacamole:MasterPassword"];

        private HttpClient CreateGuacClient()
        {
            var client = _httpClientFactory.CreateClient("GuacamoleAPI");
            client.BaseAddress = new Uri(ApiUrl);
            return client;
        }

        // =========================================================================
        // Master Token Alma (Admin yetkisiyle)
        // =========================================================================
        public async Task<string?> GetMasterTokenAsync()
        {
            // Şifre kontrolü
            if (string.IsNullOrEmpty(MasterPass))
            {
                Console.WriteLine("KRİTİK HATA: Admin şifresi (Guacamole:MasterPassword) yapılandırmada bulunamadı!");
                return null;
            }

            // Her seferinde Admin adına taze bir token alır.
            return await GetAuthTokenAsync(MasterUser, MasterPass);
        }

        // 1. Token Alma
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

        // 2. Bağlantıları Listeleme
        public async Task<List<GuacConnectionDetail>> GetConnectionsAsync(string authToken)
        {
            var client = CreateGuacClient();
            var url = $"session/data/{DataSource}/connections?token={authToken}";

            try
            {
                var response = await client.GetAsync(url);
                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"Bağlantı Listesi Çekilemedi: {response.StatusCode}");
                    return new List<GuacConnectionDetail>();
                }

                var json = await response.Content.ReadAsStringAsync();
                var rawData = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json);
                var connectionList = new List<GuacConnectionDetail>();

                if (rawData != null)
                {
                    foreach (var item in rawData)
                    {
                        string protocol = "unknown";
                        string name = "Bilinmeyen";

                        if (item.Value.TryGetProperty("protocol", out var p)) protocol = p.GetString();
                        if (item.Value.TryGetProperty("name", out var n)) name = n.GetString();

                        if (protocol == "rdp")
                        {
                            connectionList.Add(new GuacConnectionDetail
                            {
                                Identifier = item.Key,
                                Name = name,
                                Protocol = protocol
                            });
                        }
                    }
                }
                return connectionList;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Bağlantı Listesi Hatası: {ex.Message}");
                return new List<GuacConnectionDetail>();
            }
        }

        // 3. Bağlantı Oluşturma (Admin Paneli İçin)
        public async Task<string?> CreateConnectionAsync(string authToken, string host, string username, string password)
        {
            var client = CreateGuacClient();

            var parameters = new Dictionary<string, string>
            {
                {"hostname", host},
                {"port", "3389"},
                {"username", username},
                {"password", password},
                {"ignore-cert", "true"},
                {"security", "any"},
                {"timeout", "15000"},
                {"read-timeout", "20000"}
            };

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

            var url = $"session/data/{DataSource}/connections?token={authToken}";

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
            var url = $"session/data/{DataSource}/connections/{connectionId}/tunnels?token={authToken}";

            try
            {
                var response = await client.PostAsync(url, null);
                if (!response.IsSuccessStatusCode)
                {
                    string errorContent = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"Tünel Anahtarı Alma Başarısız: {response.StatusCode}");
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