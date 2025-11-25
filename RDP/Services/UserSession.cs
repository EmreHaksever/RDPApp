namespace RDPApp.Services
{
    public class UserSession
    {
        public string Username { get; set; }
        public string AuthToken { get; set; }

        // Admin olup olmadığını basitçe kullanıcı adına göre belirliyoruz.
        // İstersen buraya "guacadmin" gibi admin kullanıcının adını yazabilirsin.
        public bool IsAdmin => Username?.ToLower() == "admin" || Username?.ToLower() == "guacadmin";
        //public bool IsAdmin => true;

        public bool IsLoggedIn => !string.IsNullOrEmpty(AuthToken);
    }
}