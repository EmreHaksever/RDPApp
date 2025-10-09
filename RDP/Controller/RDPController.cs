// Controllers/RDPController.cs

using Microsoft.AspNetCore.Mvc;
using RDPApp.Services;
using System.Threading.Tasks;

namespace RDPApp.Controllers
{
    // Model, Blazor'dan RDP bilgilerini almak için kullanılır
    public class RDPConnectModel
    {
        // Name, Host, Port, Username, Password alanlarını tutar
        public string Host { get; set; } = "192.168.1.1"; // Örnek IP
        public string Username { get; set; } = "User";
        public string Password { get; set; } = "Pass123";
    }

    // Blazor Frontend'e gönderilecek Nihai Yanıt
    public record GuacConnectInfo(string TunnelKey, string ConnectionId);

    [ApiController]
    [Route("api/[controller]")]
    public class RDPController : ControllerBase
    {
        private readonly GuacamoleService _guacamoleService;

        // Guacamole API'ye erişecek yönetici hesabı bilgileri (Gerçekte gizli tutulmalı!)
        private const string GuacAdminUser = "guacadmin";
        private const string GuacAdminPass = "guacadmin";

        public RDPController(GuacamoleService guacamoleService)
        {
            _guacamoleService = guacamoleService;
        }

        // Blazor'dan gelen RDP bilgilerini işleyip tünel anahtarını döndürür
        [HttpPost("start-session")]
        public async Task<IActionResult> StartSession([FromBody] RDPConnectModel model)
        {
            // 1. ADIM: Guacamole Admin Token'ını Al
            var authToken = await _guacamoleService.GetAuthTokenAsync(GuacAdminUser, GuacAdminPass);
            if (string.IsNullOrEmpty(authToken))
                return Unauthorized(new { message = "Guacamole kimlik doğrulaması başarısız." });

            // 2. ADIM: RDP Bilgileri ile Dinamik Bağlantı Oluştur
            var connectionId = await _guacamoleService.CreateConnectionAsync(
                authToken,
                model.Host,
                model.Username,
                model.Password
            );

            if (string.IsNullOrEmpty(connectionId))
                return StatusCode(500, new { message = "Guacamole bağlantısı oluşturulamadı." });

            // 3. ADIM: Bağlantı ID'si ile Tünel Anahtarını (Session Key) Al
            var tunnelKey = await _guacamoleService.GetTunnelKeyAsync(authToken, connectionId);

            if (string.IsNullOrEmpty(tunnelKey))
                return StatusCode(500, new { message = "Guacamole tünel anahtarı alınamadı." });

            // Blazor ön yüzüne, WebSocket bağlantısı için gereken anahtarları gönder
            return Ok(new GuacConnectInfo(tunnelKey, connectionId));
        }

        // GetToken metodu artık kullanılmayacak, yerine StartSession kullanılacak.
    }
}