import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Users, Waves, Calendar } from "lucide-react";

const stats = [
  { title: "בריכות פעילות", value: "3", icon: MapPin, color: "bg-primary/10 text-primary" },
  { title: "שחיינים רשומים", value: "156", icon: Users, color: "bg-accent/10 text-accent" },
  { title: "שיעורים היום", value: "12", icon: Calendar, color: "bg-success/10 text-success" },
  { title: "מאמנים", value: "8", icon: Waves, color: "bg-warning/10 text-warning" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">לוח בקרה</h1>
        <p className="text-muted-foreground mt-1">ברוכים הבאים למערכת AquaFlow</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="card-hover border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>שיעורים קרובים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="h-12 w-12 rounded-lg gradient-primary flex items-center justify-center">
                  <Waves className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">שחייה למתחילים</p>
                  <p className="text-sm text-muted-foreground">09:00 - בריכה מרכזית</p>
                </div>
                <span className="text-sm text-muted-foreground">8 משתתפים</span>
              </div>
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                <div className="h-12 w-12 rounded-lg bg-accent flex items-center justify-center">
                  <Waves className="h-6 w-6 text-accent-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">שחייה מתקדמים</p>
                  <p className="text-sm text-muted-foreground">10:30 - בריכה אולימפית</p>
                </div>
                <span className="text-sm text-muted-foreground">12 משתתפים</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>פעילות אחרונה</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-success" />
                <p className="text-sm flex-1">שחיין חדש נרשם - דני כהן</p>
                <span className="text-xs text-muted-foreground">לפני 5 דקות</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <p className="text-sm flex-1">שיעור הסתיים - שחייה למתחילים</p>
                <span className="text-xs text-muted-foreground">לפני 30 דקות</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-warning" />
                <p className="text-sm flex-1">תשלום התקבל - משפחת לוי</p>
                <span className="text-xs text-muted-foreground">לפני שעה</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
