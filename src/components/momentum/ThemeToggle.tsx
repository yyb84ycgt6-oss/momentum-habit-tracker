import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/lib/use-theme";

const OPTS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light",  icon: Sun,     label: "Light"  },
  { value: "dark",   icon: Moon,    label: "Dark"   },
  { value: "system", icon: Monitor, label: "System" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="inline-flex items-center rounded-full bg-muted p-1 gap-1">
      {OPTS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          aria-label={label}
          className={
            "size-7 grid place-items-center rounded-full transition-colors " +
            (theme === value
              ? "bg-background text-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
