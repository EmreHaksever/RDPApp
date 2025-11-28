namespace RDPApp.Services
{
    public class UserSession
    {
        public string Username { get; set; }
        public string AuthToken { get; set; }

        public bool IsAdmin { get; set; }

        public bool IsLoggedIn => !string.IsNullOrEmpty(AuthToken);
    }
}