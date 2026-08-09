import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { useNavigation } from "@/hooks/NavigationContext";
import { DropletIcon } from "lucide-react";

export default function PrecipitationOverview({ precip }: { precip: number | undefined }) {
    const barWidth = precip ? `${Math.min(precip / 15, 1) * 100}%` : 0;
    const { navigate } = useNavigation();

    return (
        <Card onClick={() => (navigate("weather", { scrollTo: "precipitation" }))} className="relative overflow-hidden flex-1 min-w-0">
            <div
                className="pointer-events-none absolute inset-0 blur-3xl opacity-25"
                style={{ background: "radial-gradient(ellipse 100% 100% at 50% 0%, #3b82f6, transparent 90%)" }}
            />
            <CardContent className="px-1 py-4 relative">
                <div className="flex items-center gap-1.5 mb-2.5">
                    <DropletIcon size={16} className="shrink-0 text-blue-400"/>
                    <CardTitle className="text-xs text-muted-foreground font-medium tracking-wide whitespace-normal">
                        Precipitation
                    </CardTitle>
                </div>
                <div className="flex items-baseline gap-1.5 mb-2.5 pt-4 w-3/4 mx-auto">
                    <span className={`text-3xl font-medium leading-none "text-blue-400"`}>
                        {precip}
                    </span>
                    <span className="text-xs text-muted-foreground">mm</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full w-3/4 mx-auto">
                    <div
                        className="h-full bg-blue-400 rounded-full transition-[width] duration-300"
                        style={{ width: barWidth }}
                    />
                </div>
            </CardContent>
        </Card>
    );
}