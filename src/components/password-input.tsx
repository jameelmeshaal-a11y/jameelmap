import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  /** اسم مستخدم في autoComplete — استخدم "new-password" لنماذج إنشاء حساب وتعطيل الـ autofill */
  autoComplete?: string;
};

/**
 * حقل كلمة مرور مع زر إظهار/إخفاء.
 * - يبدّل type بين "password" و"text".
 * - يحافظ على dir="ltr" تلقائياً ليُعرض النص الإنجليزي بشكل صحيح.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(
  ({ className, autoComplete = "current-password", ...rest }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          dir="ltr"
          autoComplete={autoComplete}
          className={cn("pl-10", className)}
          {...rest}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
