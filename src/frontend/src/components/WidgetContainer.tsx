import { Card } from "./ui/card";

export function WidgetContainer({ children, onClick ,className }: { children: React.ReactNode, onClick?: () => void, className?: string }) {
    return (
        <Card className={`w-full h-full p-4 ${className || ''}`} onClick={onClick}>
            {children}
        </Card>
    );
}