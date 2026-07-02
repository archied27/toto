import { Card } from "./ui/card";

export function HeroContainer({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <Card className={`w-full h-full p-4 ${className || ''}`}>
            {children}
        </Card>
    );
}