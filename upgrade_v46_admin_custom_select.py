import re

with open("client/src/pages/Admin.tsx", "r", encoding="utf-8") as f:
    adm = f.read()

old_imp = 'import { useEffect, useRef, useState } from "react";'
new_imp = 'import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";'
assert old_imp in adm, "Could not find React import"
adm = adm.replace(old_imp, new_imp, 1)

admin_select_comp = """
function AdminSelect({
  value,
  onChange,
  children,
  className,
  style,
  disabled,
  required: _req,
  "aria-label": ariaLabel,
}: {
  value?: string | number | readonly string[];
  onChange?: (e: { target: { value: string }; currentTarget: { value: string } }) => void;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const options: Array<{ value: string; label: string; disabled?: boolean }> = [];
  const collect = (nodes: ReactNode) => {
    Children.forEach(nodes, child => {
      if (!child) return;
      if (Array.isArray(child)) { collect(child); return; }
      if (isValidElement(child)) {
        const props = child.props as any;
        if (child.type === "option") {
          const val = props.value !== undefined ? String(props.value) : String(props.children ?? "");
          const lbl = Array.isArray(props.children) ? props.children.map((c: any) => String(c ?? "")).join("") : String(props.children ?? val);
          options.push({ value: val, label: lbl, disabled: Boolean(props.disabled) });
        } else if (props?.children) {
          collect(props.children);
        }
      }
    });
  };
  collect(children);

  const strVal = value !== undefined && value !== null ? String(value) : "";
  const selectedOpt = options.find(o => o.value === strVal) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={className} style={{ position: "relative", width: "100%", ...style, padding: 0, border: 0, background: "transparent" }}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => !disabled && setOpen(p => !p)}
        style={{
          width: "100%",
          minHeight: style?.height || "40px",
          padding: "7px 11px",
          borderRadius: "10px",
          border: open ? "1.5px solid #870210" : "1px solid #e2d4c8",
          background: disabled ? "#f5f1ed" : "#ffffff",
          color: "#2b120f",
          fontSize: "12.5px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "right",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedOpt?.label || "اختر..."}
        </span>
        <ChevronDown
          size={15}
          style={{
            color: "#870210",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            left: 0,
            minWidth: "180px",
            maxHeight: "230px",
            overflowY: "auto",
            background: "#ffffff",
            border: "1px solid #e2d4c8",
            borderRadius: "12px",
            boxShadow: "0 10px 26px rgba(43, 18, 15, 0.14)",
            padding: "4px",
            zIndex: 80,
            display: "grid",
            gap: "2px",
          }}
        >
          {options.map((opt, idx) => {
            const active = opt.value === strVal;
            return (
              <button
                key={opt.value + "::" + idx}
                type="button"
                disabled={opt.disabled}
                onClick={() => {
                  setOpen(false);
                  if (onChange) onChange({ target: { value: opt.value }, currentTarget: { value: opt.value } });
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: 0,
                  background: active ? "#fdf3ed" : "transparent",
                  color: active ? "#870210" : opt.disabled ? "#b0a29b" : "#2b120f",
                  fontSize: "12.5px",
                  fontWeight: active ? 800 : 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  textAlign: "right",
                  cursor: opt.disabled ? "not-allowed" : "pointer",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.label}</span>
                {active && <Check size={14} strokeWidth={2.5} style={{ color: "#870210", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
"""

adm = re.sub(r'<select(\s|>)', r'<AdminSelect\1', adm)
adm = adm.replace('</select>', '</AdminSelect>')

anchor_money = 'const money = (value: number) =>'
assert anchor_money in adm, "Could not find money anchor"
adm = adm.replace(anchor_money, admin_select_comp + "\n" + anchor_money, 1)

with open("client/src/pages/Admin.tsx", "w", encoding="utf-8") as f:
    f.write(adm)

print("✅ تم استبدال جميع القوائم المنسدلة في الإدارة بتصميم AdminSelect الخفيف والأنيق")
