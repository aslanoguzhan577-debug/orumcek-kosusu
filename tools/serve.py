# Yerel geliştirme sunucusu (port 5173). Tarayıcı eski JS dosyalarını çalıştırmasın diye önbelleği kapatır.
import http.server


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    http.server.test(HandlerClass=NoCacheHandler, port=5173)
