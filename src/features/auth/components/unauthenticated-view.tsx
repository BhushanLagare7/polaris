import { ShieldAlertIcon } from "lucide-react";
import { SignInButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";

export const UnauthenticatedView = () => {
  return (
    <div className="flex justify-center items-center h-screen bg-background">
      <div className="w-full max-w-lg bg-muted">
        <Item variant="outline">
          <ItemMedia variant="icon">
            <ShieldAlertIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Unauthorized Access</ItemTitle>
            <ItemDescription>
              You are not authorized to access this resource.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <SignInButton mode="modal">
              <Button size="sm" variant="outline">
                Sign In
              </Button>
            </SignInButton>
          </ItemActions>
        </Item>
      </div>
    </div>
  );
};
