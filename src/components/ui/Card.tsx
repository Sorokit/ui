import {
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  type ElementType,
  forwardRef,
  type ReactElement,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type PolymorphicRef<E extends ElementType> = ComponentPropsWithRef<E>["ref"];

type PolymorphicProps<E extends ElementType, Props extends object> = Props &
  Omit<ComponentPropsWithoutRef<E>, keyof Props | "as"> & {
    as?: E;
  };

type PolymorphicComponent<
  DefaultElement extends ElementType,
  Props extends object = object,
> = {
  <E extends ElementType = DefaultElement>(
    props: PolymorphicProps<E, Props> & { ref?: PolymorphicRef<E> },
  ): ReactElement | null;
  displayName?: string;
};

interface BaseProps {
  className?: string;
  children?: ReactNode;
}

export const Card = forwardRef<HTMLElement, BaseProps & { as?: ElementType }>(
  function Card({ as, className, children, ...props }, ref) {
    const Component = (as ?? "div") as ElementType;
    return (
      <Component
        ref={ref}
        className={cn("rounded-xl border border-line bg-surface", className)}
        {...props}
      >
        {children}
      </Component>
    );
  },
) as PolymorphicComponent<"div", BaseProps>;
Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLElement, BaseProps & { as?: ElementType }>(
  function CardHeader({ as, className, children, ...props }, ref) {
    const Component = (as ?? "div") as ElementType;
    return (
      <Component
        ref={ref}
        className={cn("px-5 py-4 border-b border-line", className)}
        {...props}
      >
        {children}
      </Component>
    );
  },
) as PolymorphicComponent<"div", BaseProps>;
CardHeader.displayName = "CardHeader";

type HeadingLevel = "h1" | "h2" | "h3" | "h4";

interface CardTitleProps extends ComponentPropsWithoutRef<"h3"> {
  /** Heading level to render. Defaults to "h3". */
  as?: HeadingLevel;
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ as: Tag = "h3", className, children, ...props }, ref) => (
    <Tag
      ref={ref}
      className={cn("text-[14px] font-semibold text-ink", className)}
      {...props}
    >
      {children}
    </Tag>
  ),
);
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<HTMLElement, BaseProps & { as?: ElementType }>(
  function CardDescription({ as, className, children, ...props }, ref) {
    const Component = (as ?? "p") as ElementType;
    return (
      <Component
        ref={ref}
        className={cn("text-[12px] text-ink-3 mt-1", className)}
        {...props}
      >
        {children}
      </Component>
    );
  },
) as PolymorphicComponent<"p", BaseProps>;
CardDescription.displayName = "CardDescription";

interface CardContentOwnProps extends BaseProps {
  /** Removes the default p-5 padding, e.g. for full-bleed images or tables. */
  noPadding?: boolean;
}

export const CardContent = forwardRef<HTMLElement, CardContentOwnProps & { as?: ElementType }>(
  function CardContent(
    { as, className, children, noPadding, ...props },
    ref,
  ) {
    const Component = (as ?? "div") as ElementType;
    return (
      <Component
        ref={ref}
        className={cn(noPadding ? "p-0" : "p-5", className)}
        {...props}
      >
        {children}
      </Component>
    );
  },
) as PolymorphicComponent<"div", CardContentOwnProps>;
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<HTMLElement, BaseProps & { as?: ElementType }>(
  function CardFooter({ as, className, children, ...props }, ref) {
    const Component = (as ?? "div") as ElementType;
    return (
      <Component
        ref={ref}
        className={cn(
          "px-5 pb-5 pt-4 border-t border-line flex gap-3",
          className,
        )}
        {...props}
      >
        {children}
      </Component>
    );
  },
) as PolymorphicComponent<"div", BaseProps>;
CardFooter.displayName = "CardFooter";
