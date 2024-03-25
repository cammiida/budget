import type { PropsWithChildren } from "react";
import React from "react";
import type { Location } from "react-router-dom";
import { Link, useNavigation } from "@remix-run/react";
import type { RemixLinkProps } from "@remix-run/react/dist/components";
import type { ButtonProps } from "./button";
import { Button } from "./button";
import type { LucideIcon } from "lucide-react";

function isEqual(
  transitionLocation: Location,
  linkTo: RemixLinkProps["to"],
): boolean {
  if (!linkTo) {
    return false;
  }

  const transitionTo = `${transitionLocation.pathname}${transitionLocation.search}`;

  return (
    transitionTo ===
    (typeof linkTo === "string" ? linkTo : `${linkTo.pathname}${linkTo.search}`)
  );
}

/**
 * A link button which will automatically show a loading state if currently navigating to it's href.
 */
export default function LinkButton({
  children,
  icon: Icon,
  ...props
}: PropsWithChildren<
  Omit<ButtonProps, "as"> & RemixLinkProps & { icon?: LucideIcon }
>) {
  const navigation = useNavigation();

  const isNavigating =
    navigation.state === "loading" && isEqual(navigation.location, props.to);

  return (
    <Link {...props} className="self-end">
      <Button disabled={isNavigating || props.disabled} {...props}>
        {Icon && <Icon className="mr-2 h-4 w-4" />}
        {children}
      </Button>
    </Link>
  );
}
