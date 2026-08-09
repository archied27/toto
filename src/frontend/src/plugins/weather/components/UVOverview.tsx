import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { SunIcon } from "lucide-react";
import { uvColour, uvLabel } from "../utils";
import { useNavigation } from "@/hooks/NavigationContext";

export default function UVOverview({ uv_max }: { uv_max: number | undefined }) {
    const barWidth = uv_max ? `${Math.min(uv_max / 10, 1) * 100}%` : 0;
    const { navigate } = useNavigation();

    return (
        <Card className="border-none shadow-none relative overflow-hidden flex-1 min-w-0" onClick={() => (navigate("weather", { scrollTo: "uv" }))}>
            <div
                className="pointer-events-none absolute inset-0 blur-3xl opacity-25"
                style={{ background: uv_max ? `radial-gradient(ellipse 100% 100% at 50% 0%, ${uvColour(uv_max)}, transparent 90%)` : 'transparent' }}
            />
            <CardContent className="px-5 py-4 relative">
                <div className="flex items-center gap-1.5 mb-2.5">
                    <SunIcon width={16} height={16} color="orange" />
                    <CardTitle className="text-xs text-muted-foreground font-medium tracking-wide">
                        UV Index
                    </CardTitle>
                </div>
                <div className="flex items-baseline gap-1.5 mb-2.5">
                    <span className={`text-3xl font-medium leading-none "text-blue-400"`}>
                        {uv_max?.toFixed()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {uv_max ? uvLabel(uv_max) : "-"}
                    </span>
                    </div>
                    <div className="h-1 bg-muted rounded-full">
                    <div
                        className="h-full rounded-full transition-[width] duration-300"
                        style={{ width: barWidth, background: uv_max ? uvColour(uv_max) : "yellow"}}
                    />
                </div>
            </CardContent>
        </Card>
    );
}