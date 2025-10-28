import { DocHandle, Repo } from "@automerge/automerge-repo/slim";
import {
    createModelLibraryWithRepo,
    newMorphismDecl,
    newObjectDecl,
} from "../../frontend/src/model";
import { newFormalCell, NotebookUtils } from "../../frontend/src/notebook";
import { stdTheories } from "../../frontend/src/stdlib";
import { ModelDoc } from "./model_datatype";
import { ModelTypeMeta } from "../../frontend/src/theory";

export default async function addCell(handle: DocHandle<ModelDoc>, repo: Repo) {
    const models = createModelLibraryWithRepo(repo, stdTheories);
    const liveModel = await models.getLiveModel(handle.url);

    const modelCellConstructor = (meta: ModelTypeMeta) => {
        const { name, description, shortcut } = meta;
        return {
            name,
            description,
            shortcut,
            construct() {
                return meta.tag === "ObType"
                    ? newFormalCell(newObjectDecl(meta.obType))
                    : newFormalCell(newMorphismDecl(meta.morType));
            },
        };
    };

    const theory = liveModel.theory();
    const cellConstructors = (theory?.modelTypes ?? []).map(
        modelCellConstructor
    );

    if (cellConstructors.length === 0) {
        throw new Error("No cell constructors found");
    }

    handle.change((doc) => {
        const notebook = doc.notebook;
        const newCell = cellConstructors[0].construct();
        const index = notebook.cellOrder.length;
        NotebookUtils.insertCellAtIndex(notebook, newCell, index);
    });
}
