import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { LeafIcon } from "lucide-react";
import { pollenColour, pollenLabel } from "../utils";
import { useNavigation } from "@/hooks/NavigationContext";

export default function PollenOverview({ pollen }: { pollen: number | undefined }) {
    const barWidth = pollen ? `${Math.min(pollen / 140, 1) * 100}%` : 0;
    const { navigate } = useNavigation();

    return (
        <Card className="border-none shadow-none relative overflow-hidden flex-1 min-w-0" onClick={() => (navigate("weather", {scrollTo: "pollen"}))}>
            <div
                className="pointer-events-none absolute inset-0 blur-3xl opacity-25"
                style={{ background: pollen ? `radial-gradient(ellipse 100% 100% at 50% 0%, ${pollenColour(pollen)}, transparent 90%)` : 'transparent' }}
            />
            <CardContent className="px-5 py-4 relative">
                <div className="flex items-center gap-1.5 mb-2.5">
                    <LeafIcon width={16} height={16} color="green" />
                    <CardTitle className="text-xs text-muted-foreground font-medium tracking-wide">
                        Pollen
                    </CardTitle>
                </div>
                <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-medium leading-none "text-blue-400"`}>
                        {pollen ? pollenLabel(pollen): "-"}
                    </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {pollen ? pollen.toFixed() : "-"} <span className="text-[10px]">g/m3</span>
                    </span>
                    <div className="h-1 bg-muted rounded-full mt-2.5">
                    <div
                        className="h-full rounded-full transition-[width] duration-300"
                        style={{ width: barWidth, background: pollen ? pollenColour(pollen) : "yellow"}}
                    />
                </div>
            </CardContent>
        </Card>
    );
}