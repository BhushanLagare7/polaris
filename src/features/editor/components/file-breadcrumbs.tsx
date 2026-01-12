import { Fragment } from "react";

import { FileIcon } from "@react-symbols/icons/utils";

import { useEditor } from "@/features/editor/hooks/use-editor";
import { useFilePath } from "@/features/projects/hooks/use-files";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { Id } from "../../../../convex/_generated/dataModel";

export const FileBreadcrumbs = ({
  projectId,
}: {
  projectId: Id<"projects">;
}) => {
  const { activeTabId } = useEditor(projectId);
  const filePath = useFilePath(activeTabId);

  if (filePath === undefined || !activeTabId) {
    return (
      <div className="p-2 pl-4 border-b bg-background">
        <Breadcrumb>
          <BreadcrumbList className="sm:gap-0.5 gap-0.5">
            <BreadcrumbItem className="text-sm">
              <BreadcrumbPage>&nbsp;</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    );
  }

  return (
    <div className="p-2 pl-4 border-b bg-background">
      <Breadcrumb>
        <BreadcrumbList className="sm:gap-0.5 gap-0.5">
          {filePath.map((item, index) => {
            const isLast = index === filePath.length - 1;

            return (
              <Fragment key={item._id}>
                <BreadcrumbItem className="text-sm">
                  {isLast ? (
                    <BreadcrumbPage className="flex gap-1 items-center">
                      <FileIcon
                        autoAssign
                        className="size-4"
                        fileName={item.name}
                      />
                      {item.name}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href="#">{item.name}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};
