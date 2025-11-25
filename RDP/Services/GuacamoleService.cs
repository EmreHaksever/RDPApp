using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;

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
        private const string GuacApiBaseUrl = "http://localhost:8080/api/";
        private readonly IHttpClientFactory _httpClientFactory;

        // Docker kurulumuna göre veri kaynağı 'mysql', 'postgresql' veya 'default' olabilir.
        // Genelde Docker kurulumlarında 'mysql' veya 'postgresql' kullanılır.
        private const string DataSource = "mysql";

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

        // 1. Token Alma (Aynen Korundu)
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

        // =========================================================================
        // YENİ EKLENEN METOD: Kayıtlı Bağlantıları Listeleme
        // =========================================================================
        public async Task<List<GuacConnectionDetail>> GetConnectionsAsync(string authToken)
        {
            var client = CreateGuacClient();
            // Guacamole API, bağlantıları bir Dictionary (Map) olarak döner.
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

                // API Yanıtı şöyledir: { "1": { "name": "PC1", ... }, "2": { "name": "PC2"... } }
                // Bu yüzden Dictionary<string, JsonElement> olarak parse ediyoruz.
                var rawData = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(json);

                var connectionList = new List<GuacConnectionDetail>();

                if (rawData != null)
                {
                    foreach (var item in rawData)
                    {
                        // item.Key = Connection ID (Örn: "3")
                        // item.Value = Connection Detayları (Örn: { "name": "Muhasebe", "protocol": "rdp" ... })

                        string protocol = "unknown";
                        string name = "Bilinmeyen";

                        if (item.Value.TryGetProperty("protocol", out var p)) protocol = p.GetString();
                        if (item.Value.TryGetProperty("name", out var n)) name = n.GetString();

                        // Sadece RDP olanları filtreleyelim (İsteğe bağlı, SSH vs. de varsa kaldırabilirsin)
                        if (protocol == "rdp")
                        {
                            connectionList.Add(new GuacConnectionDetail
                            {
                                Identifier = item.Key, // Bu ID'yi connect metodunda kullanacağız
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

        // =========================================================================
        // ESKİ METOD (Korundu): Dinamik Bağlantı Oluşturma
        // (Admin panelinde yeni makine eklemek istersen bunu kullanabilirsin)
        // =========================================================================
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