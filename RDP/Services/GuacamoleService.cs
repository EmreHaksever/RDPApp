using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace RDPApp.Services
{
    public class GuacamoleService
    {
        private readonly HttpClient _httpClient;

        public GuacamoleService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        private record GuacLoginResponse(string authToken);

        public async Task<string?> GetAuthTokenAsync(string username, string password)
        {
            var formData = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("username", username),
                new KeyValuePair<string, string>("password", password)
            });

            // Docker’daki Guacamole API endpoint
            string url = "http://localhost:8080/api/tokens";

            var response = await _httpClient.PostAsync(url, formData);
            if (!response.IsSuccessStatusCode)
                return null;

            string json = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<GuacLoginResponse>(json);
            return data?.authToken;
        }

        public async Task<string?> CreateConnectionAsync(string authToken, string host, string username, string password)
        {
            string url = "http://localhost:8080/api/session/data/mysql/connections";

            var connectionData = new
            {
                name = "RemoteSession",
                protocol = "rdp",
                parameters = new
                {
                    hostname = host,
                    port = "3389",
                    username = username,
                    password = password
                }
            };

            string json = JsonSerializer.Serialize(connectionData);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", authToken);

            var response = await _httpClient.PostAsync(url, content);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync();
            }

            return null;
        }
    }
}
