import { exposeThemeContext } from "./theme/theme-context";
import { exposeWindowContext } from "./window/window-context";
import { exposeFileContext } from "./file/file-context";
import { exposeOGContext } from "./og/og-context";

export default function exposeContexts() {
    exposeWindowContext();
    exposeThemeContext();
    exposeFileContext();
    exposeOGContext();
}
