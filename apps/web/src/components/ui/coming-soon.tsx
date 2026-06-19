import { Construction } from 'lucide-react';

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center">
        <Construction className="h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-lg font-medium">Em desenvolvimento</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Esta seção ainda será construída.
        </p>
      </div>
    </div>
  );
}
