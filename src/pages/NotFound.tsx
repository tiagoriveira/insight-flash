import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="mb-8">
          <div className="text-6xl font-bold text-primary mb-4">404</div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Página não encontrada
          </h1>
          <p className="text-muted-foreground">
            A página que você está procurando não existe ou foi movida.
          </p>
        </div>
        
        <div className="space-y-4">
          <Button asChild className="w-full">
            <a href="/">
              <Home className="mr-2" size={16} />
              Voltar ao Início
            </a>
          </Button>
          
          <Button variant="outline" asChild className="w-full">
            <a href="/">
              <Search className="mr-2" size={16} />
              Explorar Insights
            </a>
          </Button>
        </div>
        
        <div className="mt-8 text-xs text-muted-foreground">
          Erro 404 • Caminho tentado: {location.pathname}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
