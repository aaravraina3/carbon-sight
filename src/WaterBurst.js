import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
export default function WaterBurst({ show, color }) {
    const burstKey = useMemo(() => (show ? Date.now() : 0), [show]);
    if (!show)
        return null;
    return (_jsx("div", { "data-color": color, className: "wb-allow-motion pointer-events-none absolute inset-0 z-0" /* behind z-20 content */, "aria-hidden": true, children: _jsx("svg", { className: "h-full w-full", viewBox: "0 0 100 100", preserveAspectRatio: "none", shapeRendering: "geometricPrecision", children: _jsx("g", { className: "wb-rise", children: _jsx("g", { children: _jsxs("g", { children: [_jsx("path", { className: "wb-surface", d: "\n                  M 0 22\n                  C 16 16, 34 28, 50 22\n                  S 84 16, 100 22\n                  L 100 100\n                  L 0 100\n                  Z\n                " }), _jsx("path", { className: "wb-surface", transform: "translate(-100 0)", d: "\n                  M 0 22\n                  C 16 16, 34 28, 50 22\n                  S 84 16, 100 22\n                  L 100 100\n                  L 0 100\n                  Z\n                " }), _jsx("animateTransform", { attributeName: "transform", type: "translate", from: "0 0", to: "100 0", dur: "4s", repeatCount: "indefinite", calcMode: "linear" })] }) }) }) }) }, burstKey));
}
