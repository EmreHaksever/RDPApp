namespace RDPApp.Services
{
    public class UserSession
    {
        public string Username { get; set; }
        public string AuthToken { get; set; }

        
        // Admin kullanıcı adı buraya yazılacak
        public bool IsAdmin => Username?.ToLower() == "admin" || Username?.ToLower() == "guacadmin";
        

        public bool IsLoggedIn => !string.IsNullOrEmpty(AuthToken);
    }
}