"use client";

import { Allotment } from "allotment";

import { Id } from "../../../../convex/_generated/dataModel";

import { Navbar } from "./navbar";

import "allotment/dist/style.css";

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 800;
const DEFAULT_CONVERSATION_SIDEBAR_WIDTH = 400;
const DEFAULT_MAIN_SIZE = 1000;

interface ProjectIdLayoutProps {
  children: React.ReactNode;
  projectId: Id<"projects">;
}

export const ProjectIdLayout = ({
  children,
  projectId,
}: ProjectIdLayoutProps) => {
  return (
    <div className="flex flex-col w-full h-screen">
      <Navbar projectId={projectId} />
      <div className="flex overflow-hidden flex-1">
        <Allotment
          className="flex-1"
          defaultSizes={[DEFAULT_CONVERSATION_SIDEBAR_WIDTH, DEFAULT_MAIN_SIZE]}
        >
          <Allotment.Pane
            maxSize={MAX_SIDEBAR_WIDTH}
            minSize={MIN_SIDEBAR_WIDTH}
            preferredSize={DEFAULT_CONVERSATION_SIDEBAR_WIDTH}
            snap
          >
            <div>Conversation Sidebar</div>
          </Allotment.Pane>
          <Allotment.Pane>{children}</Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
};
