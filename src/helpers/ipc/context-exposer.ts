import { exposeThemeContext } from "./theme/theme-context";
import { exposeWindowContext } from "./window/window-context";
import { exposeFileContext } from "./file/file-context";

export default function exposeContexts() {
    exposeWindowContext();
    exposeThemeContext();
    exposeFileContext();
}
