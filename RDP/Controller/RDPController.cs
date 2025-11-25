/*

using Microsoft.AspNetCore.Mvc;
using RDPApp.Services;
using System.Threading.Tasks;

namespace RDPApp.Controllers
{
    // Eski manuel bağlantı modeli (Admin testi için durabilir)
    public class RDPConnectModel
    {
        public string Host { get; set; } = "192.168.1.1";
        public string Username { get; set; } = "User";
        public string Password { get; set; } = "Pass123";
    }

    // Blazor'a Auth Token ve Connection ID'yi gönderdiğimiz yanıt modeli
    public record GuacSessionInfo(string AuthToken, string ConnectionId);

    [ApiController]
    [Route("api/[controller]")]
    public class RDPController : ControllerBase
    {
        private readonly GuacamoleService _guacamoleService;

        // Bu kullanıcı Guacamole'de tanımlı, bağlantıları görme yetkisi olan kullanıcıdır.
        // Canlı ortamda "sadece okuma" yetkisi olan bir servis kullanıcısı olması önerilir.
        private const string ServiceUser = "admin";
        private const string ServicePass = "admin";

        public RDPController(GuacamoleService guacamoleService)
        {
            _guacamoleService = guacamoleService;
        }

        // =========================================================================
        // 1. ENDPOINT: Kullanıcının erişebileceği bilgisayarları listeler
        // =========================================================================
        [HttpGet("list-connections")]
        public async Task<IActionResult> GetConnections()
        {
            // 1. Servis kullanıcısı ile Guacamole'den token alıyoruz
            var authToken = await _guacamoleService.GetAuthTokenAsync(ServiceUser, ServicePass);

            if (string.IsNullOrEmpty(authToken))
                return Unauthorized(new { message = "Guacamole servisine erişilemedi." });

            // 2. Bu token ile görülebilen bağlantıları listeliyoruz
            var connections = await _guacamoleService.GetConnectionsAsync(authToken);

            return Ok(connections);
        }

        // =========================================================================
        // 2. ENDPOINT: Seçilen makineye bağlanmak için session yetkisi verir
        // =========================================================================
        [HttpGet("connect/{connectionId}")]
        public async Task<IActionResult> ConnectToMachine(string connectionId)
        {
            // Bağlantı için taze bir token alıyoruz
            var authToken = await _guacamoleService.GetAuthTokenAsync(ServiceUser, ServicePass);

            if (string.IsNullOrEmpty(authToken))
                return Unauthorized(new { message = "Kimlik doğrulama başarısız." });

            // Kullanıcıya şifre göndermiyoruz, sadece Token ve ID gönderiyoruz.
            // Bu sayede kullanıcı şifreyi asla görmüyor.
            return Ok(new GuacSessionInfo(authToken, connectionId));
        }

        // =========================================================================
        // ESKİ ENDPOINT: Manuel IP/Şifre ile bağlantı (Admin/Test için korundu)
        // =========================================================================
        [HttpPost("start-session")]
        public async Task<IActionResult> StartSession([FromBody] RDPConnectModel model)
        {
            var authToken = await _guacamoleService.GetAuthTokenAsync(ServiceUser, ServicePass);
            if (string.IsNullOrEmpty(authToken))
                return Unauthorized(new { message = "Guacamole kimlik doğrulaması başarısız." });

            var connectionId = await _guacamoleService.CreateConnectionAsync(
                authToken,
                model.Host,
                model.Username,
                model.Password
            );

            if (string.IsNullOrEmpty(connectionId))
                return StatusCode(500, new { message = "Guacamole bağlantısı oluşturulamadı." });

            return Ok(new GuacSessionInfo(authToken, connectionId));
        }
    }
}

*/