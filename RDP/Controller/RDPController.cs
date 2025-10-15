// Controllers/RDPController.cs

using Microsoft.AspNetCore.Mvc;
using RDPApp.Services;
using System.Threading.Tasks;

namespace RDPApp.Controllers
{
    public class RDPConnectModel
    {
        public string Host { get; set; } = "192.168.1.1";
        public string Username { get; set; } = "User";
        public string Password { get; set; } = "Pass123";
    }

    // YENİ YANIT MODELİ: Blazor'a Auth Token ve Connection ID'yi gönderiyoruz.
    public record GuacSessionInfo(string AuthToken, string ConnectionId);

    [ApiController]
    [Route("api/[controller]")]
    public class RDPController : ControllerBase
    {
        private readonly GuacamoleService _guacamoleService;
        private const string GuacAdminUser = "emre";
        private const string GuacAdminPass = "emre";

        public RDPController(GuacamoleService guacamoleService)
        {
            _guacamoleService = guacamoleService;
        }

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

            // 3. ADIM (DÜZELTİLDİ): Tünel anahtarı istemiyoruz.
            // Bunun yerine, aldığımız AuthToken ve ConnectionId'yi doğrudan Blazor'a geri gönderiyoruz.
            // JavaScript bu iki bilgiyi kullanarak WebSocket tünelini kuracak.

            return Ok(new GuacSessionInfo(authToken, connectionId));
        }
    }
}