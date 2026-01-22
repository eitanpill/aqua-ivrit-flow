import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Waves, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl">
      <div className="text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
          <Waves className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-foreground">404</h1>
          <p className="text-xl text-muted-foreground">אופס! הדף לא נמצא</p>
          <p className="text-sm text-muted-foreground">הדף שחיפשת אינו קיים או הוסר</p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/">
            <Home className="h-4 w-4" />
            חזרה לדף הבית
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
