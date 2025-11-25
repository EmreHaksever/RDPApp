using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.Extensions.Configuration;

namespace RDPApp.Services
{
    // Login ve Bağlantı yanıtları için mevcut recordlar
    public record GuacLoginResponse(string authToken);
    public record GuacConnectionResponse(string identifier);
    public record GuacTunnelResponse(string tunnelId, string connectionId);

    // Bağlantı listesi için model
    public class GuacConnectionDetail
    {
        public string Identifier { get; set; }
        public string Name { get; set; }
        public string Protocol { get; set; }
    }

    public class GuacamoleService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;

        // =========================================================================
        // AYAR: Bağlantıların otomatik atanacağı Guacamole Grubu
        // Guacamole panelinde bu isimde bir grup oluşturup kullanıcıları içine atmalısın!
        // =========================================================================
        private const string TargetUserGroup = "Yazılım";

        public GuacamoleService(IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
        }

        private string ApiUrl => _configuration["Guacamole:ApiUrl"] ?? "http://localhost:8080/api/";
        private string DataSource => _configuration["Guacamole:DataSource"] ?? "mysql";

        private HttpClient CreateGuacClient()
        {
            var client = _httpClientFactory.CreateClient("GuacamoleAPI");
            client.BaseAddress = new Uri(ApiUrl);
            return client;
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

        // 2. Admin Kontrolü (Guacamole Yetkilerine Göre)
        public async Task<bool> CheckIfAdminAsync(string authToken)
        {
            var client = CreateGuacClient();
            var url = $"session/data/{DataSource}/self/permissions?token={authToken}";

            try
            {
                var response = await client.GetAsync(url);
                if (!response.IsSuccessStatusCode) return false;

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);

                // 'systemPermissions' altında admin veya oluşturma yetkisi var mı?
                if (doc.RootElement.TryGetProperty("systemPermissions", out var sysPerms))
                {
                    if (sysPerms.TryGetProperty("ADMINISTER", out var p1) && p1.GetBoolean()) return true;
                    if (sysPerms.TryGetProperty("CREATE_CONNECTION", out var p2) && p2.GetBoolean()) return true;
                    if (sysPerms.TryGetProperty("CREATE_USER", out var p3) && p3.GetBoolean()) return true;
                }
                return false;
            }
            catch
            {
                return false;
            }
        }

        // 3. Bağlantıları Listeleme (Herkes kendi token'ı ile)
        public async Task<List<GuacConnectionDetail>> GetConnectionsAsync(string authToken)
        {
            var client = CreateGuacClient();
            var url = $"session/data/{DataSource}/connections?token={authToken}";

            try
            {
                var response = await client.GetAsync(url);
                if (!response.IsSuccessStatusCode) return new List<GuacConnectionDetail>();

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

        // 4. Bağlantı Oluşturma + Otomatik Grup Yetkilendirmesi
        // 4. Bağlantı Oluşturma + Otomatik Grup Yetkilendirmesi
        // GÜNCELLEME: 'connectionName' parametresi eklendi
        public async Task<string?> CreateConnectionAsync(string authToken, string connectionName, string host, string username, string password)
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

            // GÜNCELLEME: Adminin girdiği isim (connectionName) burada kullanılıyor
            var connectionData = new
            {
                name = connectionName,
                protocol = "rdp",
                parentIdentifier = "ROOT",
                type = "ORGANIZATIONAL",
                attributes = new Dictionary<string, string>(),
                parameters = parameters
            };

            var json = JsonSerializer.Serialize(connectionData);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var url = $"session/data/{DataSource}/connections?token={authToken}";

            string newConnectionId = null;

            try
            {
                // A. Bağlantıyı Oluştur
                var response = await client.PostAsync(url, content);

                if (!response.IsSuccessStatusCode)
                {
                    string errorContent = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"Hata: {response.StatusCode} - {errorContent}");
                    return null;
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<GuacConnectionResponse>(responseJson);
                newConnectionId = data?.identifier;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Bağlantı Oluşturma Hatası: {ex.Message}");
                return null;
            }

            // B. Bağlantı Başarılıysa: Gruba Yetki Ver
            if (!string.IsNullOrEmpty(newConnectionId))
            {
                var permissionData = new[]
                {
                    new {
                        op = "add",
                        path = $"/connectionPermissions/{newConnectionId}",
                        value = "READ"
                    }
                };

                var permJson = JsonSerializer.Serialize(permissionData);
                var permContent = new StringContent(permJson, Encoding.UTF8, "application/json");
                var permUrl = $"session/data/{DataSource}/userGroups/{TargetUserGroup}/permissions?token={authToken}";

                try
                {
                    var request = new HttpRequestMessage(new HttpMethod("PATCH"), permUrl)
                    {
                        Content = permContent
                    };
                    await client.SendAsync(request);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Grup Yetkilendirme Hatası: {ex.Message}");
                }
            }

            return newConnectionId;
        }

        public async Task<string?> GetTunnelKeyAsync(string authToken, string connectionId)
        {
            var client = CreateGuacClient();
            var url = $"session/data/{DataSource}/connections/{connectionId}/tunnels?token={authToken}";

            try
            {
                var response = await client.PostAsync(url, null);
                if (!response.IsSuccessStatusCode) return null;

                var responseJson = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<GuacTunnelResponse>(responseJson);
                return data?.tunnelId;
            }
            catch { return null; }
        }
    
    // YENİ: Bağlantı Silme Metodu
        public async Task<bool> DeleteConnectionAsync(string authToken, string connectionIdentifier)
        {
            var client = CreateGuacClient();
            var url = $"session/data/{DataSource}/connections/{connectionIdentifier}?token={authToken}";

            try
            {
                var response = await client.DeleteAsync(url);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Silme Hatası: {ex.Message}");
                return false;
            }
        }
    } // Class bitişi
} // Namespace bitişi
      