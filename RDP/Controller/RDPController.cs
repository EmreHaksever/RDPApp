using Microsoft.AspNetCore.Mvc;

namespace RDPApp.Controllers
{
    public class RDPConnection
    {
        public string Name { get; set; } = "";
        public string Host { get; set; } = "";
        public int Port { get; set; } = 3389;
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
        public string ConnectionId { get; set; } = "";
    }

    [ApiController]
    [Route("api/[controller]")]
    public class RDPController : ControllerBase
    {
        private static RDPConnection _connection = new RDPConnection();

        [HttpPost("create")]
        public IActionResult CreateConnection([FromBody] RDPConnection conn)
        {
            _connection = conn;
            _connection.ConnectionId = "1"; // Örnek sabit ID
            return Ok(new { message = "Connection created", connectionId = _connection.ConnectionId });
        }

        [HttpGet("token")]
        public IActionResult GetToken()
        {
            // Örnek token – gerçekte Guacamole API'den al
            string authToken = "F4E8C0160DC2F50C3EB8FDF7088F28FDD283EF849D7DB5D18BCFBC09697C02F9";

            return Ok(new
            {
                token = authToken,
                connectionId = _connection.ConnectionId,
                dataSource = "mysql"
            });
        }
    }
}
