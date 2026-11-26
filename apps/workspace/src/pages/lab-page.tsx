import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Plus, Search, Settings } from "lucide-react";
import type { DataTableColumn } from "@nethack/ui";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
    ActivityFeed,
    ActivityTimeline,
    AdvancedSearch,
    Alert,
    AlertDialog,
    Autocomplete,
    Avatar,
    AvatarFallback,
    AvatarGroup,
    Badge,
    Banner,
    BarChart,
    Breadcrumb,
    Button,
    Calendar,
    CalendarViews,
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    Carousel,
    Chart,
    Checkbox,
    CheckboxGroup,
    Chip,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    ColorPicker,
    Columns,
    Combobox,
    CommandPalette,
    ConfirmDialog,
    Container,
    ContentNavigation,
    ContentPagination,
    ContentSearch,
    ContentShell,
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
    ContextualNavigation,
    DashboardGroup,
    DashboardNavbar,
    DashboardPanel,
    DashboardResizeHandle,
    DashboardSearch,
    DashboardSearchButton,
    DashboardSidebar,
    DashboardSidebarCollapse,
    DashboardSidebarToggle,
    DashboardShell,
    DashboardToolbar,
    AnimatedDisclosure,
    CountUp,
    DataTable,
    DateInput,
    DatePicker,
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Drawer,
    DrawerContent,
    DrawerTrigger,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    EditorDragHandle,
    EditorMentionMenu,
    EditorSuggestionMenu,
    EditorToolbar,
    EmptyState,
    EvaluationRubric,
    Field,
    FieldGroup,
    FileList,
    FilePreview,
    FileUpload,
    Footer,
    FooterColumns,
    Form,
    FormField,
    Grid,
    Header,
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
    Icon,
    Input,
    Kbd,
    KeyValue,
    LineChart,
    Link,
    Listbox,
    LoadingBlock,
    Magnetic,
    Main,
    MultiStepForm,
    NavigationMenu,
    NumberInput,
    Page,
    PageBody,
    PageCard,
    PageColumns,
    PageCta,
    PageFeature,
    PageFeatures,
    PageGrid,
    PageHeader,
    PageHero,
    PageLinks,
    PageList,
    PageLogos,
    PageSection,
    PageShell,
    Pagination,
    PaginationControls,
    PinInput,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Progress,
    ProgressGroup,
    RadioGroup,
    RatingInput,
    ResizablePanels,
    Reveal,
    ResponsiveNavigationShell,
    RichTextEditor,
    ScrollArea,
    SearchInput,
    SearchNavigation,
    Section,
    Select,
    Separator,
    Sidebar,
    SidebarNavigation,
    Skeleton,
    Slideover,
    SlideoverContent,
    SlideoverTrigger,
    Slider,
    SplitTextReveal,
    Splitter,
    StaggerReveal,
    Stack,
    Statistics,
    Stepper,
    StatusIndicator,
    SubmissionReviewPanel,
    Switch,
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    TableOfContents,
    TagInput,
    Textarea,
    Tilt,
    TimeInput,
    Timeline,
    Toggle,
    ToggleGroup,
    ToggleGroupItem,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TreeView,
    UserDisplay,
    ValidationSummary,
    useToast,
} from "@nethack/ui";

const FORM_EXAMPLE = `# Example

This is a **neutral** example document for the editor.

- First item
- Second item`;

function GroupIntro({
    title,
    description,
    keyboard,
    accessibility,
}: {
    readonly title: string;
    readonly description: string;
    readonly keyboard: string;
    readonly accessibility: string;
}): ReactNode {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold tracking-tight">{title}</h2>
                <p className="text-sm text-ink-muted">{description}</p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-line bg-panel p-3">
                    <dt className="text-xs text-ink-subtle">Keyboard</dt>
                    <dd className="text-sm text-ink-muted">{keyboard}</dd>
                </div>
                <div className="rounded-md border border-line bg-panel p-3">
                    <dt className="text-xs text-ink-subtle">Accessibility</dt>
                    <dd className="text-sm text-ink-muted">{accessibility}</dd>
                </div>
            </dl>
        </div>
    );
}

function LabSection({
    title,
    description,
    children,
    className,
}: {
    readonly title: string;
    readonly description?: string;
    readonly children: ReactNode;
    readonly className?: string;
}): ReactNode {
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                {description === undefined ? null : (
                    <CardDescription>{description}</CardDescription>
                )}
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

export function LabPage(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Component laboratory"
                description="The Nethack UI design-system reference. Every example uses neutral fixtures, not production data."
            />
            <Alert tone="neutral" title="Internal route">
                The laboratory is a development and documentation surface. It is not part of the
                participant, judge, or organizer workflows.
            </Alert>

            <Tabs defaultValue="layout">
                <TabsList className="max-w-full overflow-x-auto">
                    <TabsTrigger value="layout">A. Layout</TabsTrigger>
                    <TabsTrigger value="elements">B. Elements</TabsTrigger>
                    <TabsTrigger value="forms">C. Forms</TabsTrigger>
                    <TabsTrigger value="data">D. Data</TabsTrigger>
                    <TabsTrigger value="navigation">E. Navigation</TabsTrigger>
                    <TabsTrigger value="overlays">F. Overlays</TabsTrigger>
                    <TabsTrigger value="dashboard">G. Dashboard</TabsTrigger>
                    <TabsTrigger value="page">H. Page composition</TabsTrigger>
                    <TabsTrigger value="advanced">I. Advanced</TabsTrigger>
                    <TabsTrigger value="motion">J. Motion</TabsTrigger>
                </TabsList>

                <TabsContent value="layout">
                    <LayoutGroup />
                </TabsContent>
                <TabsContent value="elements">
                    <ElementsGroup />
                </TabsContent>
                <TabsContent value="forms">
                    <FormsGroup />
                </TabsContent>
                <TabsContent value="data">
                    <DataGroup />
                </TabsContent>
                <TabsContent value="navigation">
                    <NavigationGroup />
                </TabsContent>
                <TabsContent value="overlays">
                    <OverlaysGroup />
                </TabsContent>
                <TabsContent value="dashboard">
                    <DashboardGroupLab />
                </TabsContent>
                <TabsContent value="page">
                    <PageGroup />
                </TabsContent>
                <TabsContent value="advanced">
                    <AdvancedGroup />
                </TabsContent>
                <TabsContent value="motion">
                    <MotionGroup />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function MotionGroup(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <GroupIntro
                title="J. Motion"
                description="GSAP entrance, stagger, tilt, magnetic, count-up, disclosure, and page-transition primitives."
                keyboard="Motion never changes keyboard order. Animated disclosure triggers remain buttons with aria-expanded and aria-controls."
                accessibility="Motion is skipped under prefers-reduced-motion. Headline splitting renders a separate screen-reader label."
            />
            <LabSection
                title="Headline reveal"
                description="SplitTextReveal animates characters once; the accessible label is not split."
            >
                <SplitTextReveal
                    as="h2"
                    label="nethack builds competitions"
                    className="text-2xl font-extrabold tracking-tight glow-sm"
                >
                    nethack builds competitions
                </SplitTextReveal>
            </LabSection>
            <LabSection
                title="Reveal and stagger"
                description="Scroll-triggered entrance for sections and grids."
            >
                <StaggerReveal className="grid gap-3 sm:grid-cols-3">
                    {["Registration", "Judging", "Results"].map((item) => (
                        <Card key={item} variant="soft">
                            <CardContent className="pt-4 text-sm">{item}</CardContent>
                        </Card>
                    ))}
                </StaggerReveal>
            </LabSection>
            <LabSection
                title="Tilt and magnetic"
                description="Pointer-driven depth and magnetic primary actions."
            >
                <div className="flex flex-wrap items-center gap-6">
                    <Tilt className="w-56">
                        <Card hoverable>
                            <CardContent className="pt-5 text-sm">
                                Hover to tilt this card within six degrees.
                            </CardContent>
                        </Card>
                    </Tilt>
                    <Magnetic>
                        <Button>Magnetic action</Button>
                    </Magnetic>
                </div>
            </LabSection>
            <LabSection
                title="Count-up and disclosure"
                description="Real numeric values and accessible animated disclosure."
            >
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-ink-muted">
                        Animated value: <CountUp value={128} className="font-bold text-primary" />
                    </p>
                    <AnimatedDisclosure title="Open the motion notes">
                        <p className="text-sm text-ink-muted">
                            Reduced motion switches this disclosure instantly. Scroll progress is
                            mounted once by NethackProvider.
                        </p>
                    </AnimatedDisclosure>
                </div>
            </LabSection>
            <LabSection
                title="Page transition"
                description="Workspace routes animate through PageTransition in the authenticated shell."
            >
                <Reveal>
                    <Card variant="outline">
                        <CardContent className="pt-4 text-sm text-ink-muted">
                            Navigate between workspace routes to see the entrance transition. The
                            motion is skipped when reduced motion is requested.
                        </CardContent>
                    </Card>
                </Reveal>
            </LabSection>
        </div>
    );
}

function LayoutGroup(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <GroupIntro
                title="A. Layout"
                description="Application shells, containers, section structure, and responsive grids."
                keyboard="Skip links target the main landmark. Splitter handles use arrow keys, Home, and End."
                accessibility="Each shell exposes one main landmark. Sidebars are complementary landmarks with labels."
            />
            <LabSection title="Container, section, grid, columns, and stack">
                <div className="flex flex-col gap-6">
                    <Container className="rounded-md border border-line py-4">
                        <p className="text-sm text-ink-muted">Container, max width 1280px.</p>
                    </Container>
                    <Section>
                        <p className="text-sm text-ink-muted">Section with vertical rhythm.</p>
                    </Section>
                    <Grid cols={3} gap="md">
                        {[1, 2, 3].map((value) => (
                            <div
                                key={value}
                                className="rounded-md border border-line p-3 text-sm text-ink-muted"
                            >
                                Grid column {String(value)}
                            </div>
                        ))}
                    </Grid>
                    <Columns ratio="main">
                        <div className="rounded-md border border-line p-3 text-sm">Main column</div>
                        <div className="rounded-md border border-line p-3 text-sm">
                            Aside column
                        </div>
                    </Columns>
                    <Stack direction="horizontal" gap="sm" wrap>
                        <Badge>Stack item</Badge>
                        <Badge>Stack item</Badge>
                        <Badge>Stack item</Badge>
                    </Stack>
                </div>
            </LabSection>
            <LabSection title="Page header, body, and aside">
                <div className="flex flex-col gap-4">
                    <PageHeader
                        title="Page header"
                        description="Title, description, and actions."
                        actions={<Button size="sm">Primary action</Button>}
                    />
                    <PageBody
                        aside={
                            <p className="text-sm text-ink-muted">
                                The aside is sticky on wide viewports.
                            </p>
                        }
                    >
                        <p className="text-sm text-ink-muted">Page body content.</p>
                    </PageBody>
                </div>
            </LabSection>
            <LabSection title="Splitter">
                <Splitter
                    first={
                        <div className="rounded-md border border-line p-3 text-sm">First pane</div>
                    }
                    second={
                        <div className="rounded-md border border-line p-3 text-sm">Second pane</div>
                    }
                />
            </LabSection>
            <LabSection title="Shells">
                <div className="flex flex-col gap-4">
                    <PageShell
                        className="min-h-0"
                        header={<div className="p-3 text-sm">Page shell header</div>}
                        footer={<div className="p-3 text-sm">Page shell footer</div>}
                    >
                        <div className="p-4 text-sm text-ink-muted">Page shell content</div>
                    </PageShell>
                    <ContentShell
                        className="min-h-0"
                        sidebar={<div className="text-sm text-ink-muted">Section navigation</div>}
                        aside={<div className="text-sm text-ink-muted">Page outline</div>}
                    >
                        <div className="text-sm text-ink-muted">Content shell content</div>
                    </ContentShell>
                    <DashboardShell
                        className="min-h-0"
                        navbar={<div className="p-3 text-sm">Dashboard shell navbar</div>}
                    >
                        <div className="p-4 text-sm text-ink-muted">Dashboard shell content</div>
                    </DashboardShell>
                    <ResponsiveNavigationShell
                        className="min-h-0"
                        brand={<span className="text-sm font-semibold">nethack</span>}
                        navigation={<span className="text-sm text-ink-muted">Navigation</span>}
                        actions={
                            <Button size="sm" variant="outline">
                                Action
                            </Button>
                        }
                    >
                        <p className="text-sm text-ink-muted">
                            Responsive navigation shell content.
                        </p>
                    </ResponsiveNavigationShell>
                </div>
            </LabSection>
            <LabSection title="Header, footer, sidebar, and main">
                <div className="overflow-hidden rounded-md border border-line">
                    <Header className="p-3 text-sm">Header</Header>
                    <div className="flex min-h-32">
                        <Sidebar responsive={false} width="sm" className="border-r p-3">
                            <span className="text-sm text-ink-muted">Sidebar</span>
                        </Sidebar>
                        <Main className="p-3 text-sm text-ink-muted">Main content</Main>
                    </div>
                    <Footer className="p-3 text-sm">Footer</Footer>
                </div>
            </LabSection>
        </div>
    );
}

function ElementsGroup(): ReactNode {
    const { toast } = useToast();
    return (
        <div className="flex flex-col gap-6">
            <GroupIntro
                title="B. Basic elements"
                description="Actions, status, identity, progress, and disclosure."
                keyboard="Buttons activate with Enter and Space. Toggles announce their pressed state."
                accessibility="Status is always conveyed with text. Icon-only actions require an accessible label."
            />
            <LabSection title="Button variants, sizes, and states">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button>Solid</Button>
                        <Button variant="soft">Soft</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="link">Link</Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm">Small</Button>
                        <Button size="md">Medium</Button>
                        <Button size="lg">Large</Button>
                        <Button size="icon" aria-label="Add item">
                            <Plus className="size-4" aria-hidden="true" />
                        </Button>
                        <Button loading>Loading</Button>
                        <Button disabled>Disabled</Button>
                        <Button iconLeft={<Check className="size-4" aria-hidden="true" />}>
                            With icon
                        </Button>
                    </div>
                </div>
            </LabSection>
            <LabSection title="Badge, chip, status, and banner">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge>Neutral</Badge>
                        <Badge tone="primary" dot>
                            Live
                        </Badge>
                        <Badge tone="outline">Outline</Badge>
                        <Badge tone="critical">Critical</Badge>
                        <Badge size="sm">Small badge</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Chip icon={<Check className="size-3" aria-hidden="true" />}>Chip</Chip>
                        <Chip onRemove={() => undefined} removeLabel="Remove example chip">
                            Removable
                        </Chip>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <StatusIndicator tone="success" label="Success" />
                        <StatusIndicator tone="neutral" label="Neutral" />
                        <StatusIndicator tone="attention" label="Attention" />
                        <StatusIndicator tone="pending" label="Pending" />
                    </div>
                    <Banner title="Banner title" tone="neutral">
                        A banner communicates a page-level message with an optional action.
                    </Banner>
                    <Banner
                        title="Success banner"
                        tone="success"
                        action={
                            <Button size="sm" variant="outline">
                                Action
                            </Button>
                        }
                    >
                        Success is communicated with text, not color alone.
                    </Banner>
                </div>
            </LabSection>
            <LabSection title="Alert and empty state">
                <div className="flex flex-col gap-4">
                    <Alert title="Neutral alert">
                        Informational content with recovery guidance.
                    </Alert>
                    <Alert title="Success alert" tone="success">
                        The change was saved.
                    </Alert>
                    <Alert title="Warning alert" tone="warning">
                        Review this before continuing.
                    </Alert>
                    <Alert title="Critical alert" tone="critical">
                        The request could not be completed. Try again.
                    </Alert>
                    <EmptyState
                        title="Empty state"
                        description="Explain why the surface is empty and what happens next."
                        action={<Button size="sm">Next action</Button>}
                    />
                </div>
            </LabSection>
            <LabSection title="Identity">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarFallback>NS</AvatarFallback>
                        </Avatar>
                        <AvatarGroup
                            max={3}
                            members={[
                                { name: "Example one" },
                                { name: "Example two" },
                                { name: "Example three" },
                                { name: "Example four" },
                            ]}
                            label="Example members"
                        />
                    </div>
                    <UserDisplay name="Example member" email="member@example.com" />
                    <UserDisplay name="Example member" email="member@example.com" size="sm" />
                </div>
            </LabSection>
            <LabSection title="Progress and statistics">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Progress label="Determinate" value={40} max={100} />
                    <Progress label="Indeterminate" value={null} />
                    <ProgressGroup
                        label="Progress group"
                        items={[
                            { label: "Step one", value: 100 },
                            { label: "Step two", value: 50 },
                        ]}
                        summary="Summary text for the progress group."
                    />
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-full" />
                        <LoadingBlock rows={2} label="Loading example" />
                    </div>
                </div>
            </LabSection>
            <LabSection title="Disclosure and toggles">
                <div className="flex flex-col gap-4">
                    <Collapsible defaultOpen>
                        <CollapsibleTrigger>Collapsible section</CollapsibleTrigger>
                        <CollapsibleContent>
                            Disclosure content remains in the reading order.
                        </CollapsibleContent>
                    </Collapsible>
                    <div className="flex flex-wrap gap-2">
                        <Toggle aria-label="Bold">Bold</Toggle>
                        <Toggle aria-label="Italic" variant="solid">
                            Italic
                        </Toggle>
                    </div>
                    <ToggleGroup type="single" defaultValue="one" aria-label="View density">
                        <ToggleGroupItem value="one">Comfortable</ToggleGroupItem>
                        <ToggleGroupItem value="two">Compact</ToggleGroupItem>
                    </ToggleGroup>
                </div>
            </LabSection>
            <LabSection title="Icon, keyboard shortcut, card, and separator">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <Icon icon={Settings} label="Settings" />
                        <Icon icon={Search} />
                        <span className="flex items-center gap-1 text-sm text-ink-muted">
                            Open command palette <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>
                        </span>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Card title</CardTitle>
                            <CardDescription>Card description.</CardDescription>
                        </CardHeader>
                        <CardContent>Card content.</CardContent>
                        <CardFooter>
                            <Button size="sm" variant="outline">
                                Footer action
                            </Button>
                        </CardFooter>
                    </Card>
                    <Separator />
                    <div className="flex h-10 items-center gap-3">
                        <span className="text-sm text-ink-muted">Vertical separator</span>
                        <Separator orientation="vertical" />
                        <span className="text-sm text-ink-muted">Next item</span>
                    </div>
                </div>
            </LabSection>
            <LabSection title="Calendar">
                <CalendarDemo />
            </LabSection>
            <LabSection title="Toast">
                <Button
                    type="button"
                    onClick={() =>
                        toast({
                            title: "Example notification",
                            description: "Neutral toast fixture for the laboratory.",
                        })
                    }
                >
                    Show toast
                </Button>
            </LabSection>
        </div>
    );
}

function CalendarDemo(): ReactNode {
    const [selected, setSelected] = useState<Date | undefined>(new Date("2026-01-15T12:00:00Z"));
    return (
        <div className="flex flex-col gap-2">
            <Calendar selected={selected} onSelect={setSelected} />
            <p className="text-xs text-ink-muted">
                Selected: {selected === undefined ? "none" : selected.toISOString().slice(0, 10)}
            </p>
        </div>
    );
}

const formExampleSchema = z.object({
    displayName: z.string().trim().min(1, "Enter a display name.").max(80),
});
type FormExample = z.infer<typeof formExampleSchema>;

function FormExampleDemo(): ReactNode {
    const form = useForm<FormExample>({
        resolver: zodResolver(formExampleSchema),
        defaultValues: { displayName: "" },
    });
    return (
        <Form form={form} onSubmit={form.handleSubmit(() => undefined)}>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <FormField name="displayName" label="Display name" required>
                    {(field) => <Input {...field} value={field.value} placeholder="Example name" />}
                </FormField>
                <Button type="submit">Submit</Button>
            </div>
        </Form>
    );
}

function FormsGroup(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <GroupIntro
                title="C. Forms"
                description="Inputs, pickers, selection, validation, and multi-step composition."
                keyboard="Tab moves through fields; Enter submits; Escape closes popovers and clears search."
                accessibility="Every field has a visible label, described errors, and announced validation summaries."
            />
            <LabSection title="Form and form field">
                <FormExampleDemo />
            </LabSection>
            <LabSection title="Input, textarea, search, and number">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Standard input" description="Helper text describes the field.">
                        {(props) => <Input {...props} placeholder="Type a value" />}
                    </Field>
                    <Field label="Input with error" error="This value is required.">
                        {(props) => <Input {...props} defaultValue="" />}
                    </Field>
                    <Field label="Small input">
                        {(props) => <Input {...props} size="sm" placeholder="Small" />}
                    </Field>
                    <Field label="Large input">
                        {(props) => <Input {...props} size="lg" placeholder="Large" />}
                    </Field>
                    <Field label="Textarea">
                        {(props) => <Textarea {...props} placeholder="Longer content" />}
                    </Field>
                    <SearchInput label="Search input" placeholder="Search" />
                    <NumberInput label="Number input" defaultValue={4} min={0} max={10} />
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-ink">Disabled</span>
                        <Input disabled value="Disabled input" readOnly />
                    </div>
                </div>
            </LabSection>
            <LabSection title="Dates and time">
                <div className="grid gap-4 sm:grid-cols-3">
                    <DateInput label="Date input" defaultValue="2026-01-15" />
                    <TimeInput label="Time input" defaultValue="10:30" />
                    <DatePicker
                        label="Date picker"
                        defaultValue={new Date("2026-01-15T12:00:00Z")}
                    />
                </div>
            </LabSection>
            <LabSection title="Selection controls">
                <div className="grid gap-5 sm:grid-cols-2">
                    <Select
                        label="Select"
                        options={[
                            { value: "one", label: "Option one" },
                            { value: "two", label: "Option two" },
                        ]}
                        defaultValue="one"
                    />
                    <Combobox
                        label="Combobox"
                        options={[
                            { value: "one", label: "Option one" },
                            { value: "two", label: "Option two" },
                        ]}
                        defaultValue="two"
                    />
                    <Autocomplete
                        label="Autocomplete"
                        options={[
                            { value: "one", label: "Option one" },
                            { value: "two", label: "Option two" },
                        ]}
                        defaultValue="one"
                    />
                    <Listbox
                        label="Listbox"
                        options={[
                            { value: "one", label: "Option one" },
                            { value: "two", label: "Option two" },
                        ]}
                        defaultValue={["one"]}
                    />
                    <RadioGroup
                        label="Radio group"
                        options={[
                            { value: "one", label: "Option one" },
                            { value: "two", label: "Option two" },
                        ]}
                        defaultValue="one"
                    />
                    <CheckboxGroup
                        label="Checkbox group"
                        options={[
                            { value: "one", label: "Option one" },
                            { value: "two", label: "Option two" },
                        ]}
                        defaultValue={["one"]}
                    />
                    <Checkbox label="Standalone checkbox" defaultChecked />
                    <Switch
                        label="Switch"
                        description="A switch applies immediately."
                        defaultChecked
                    />
                </div>
            </LabSection>
            <LabSection title="Slider, rating, tag, and pin">
                <div className="grid gap-5 sm:grid-cols-2">
                    <Slider label="Slider" defaultValue={[35]} />
                    <RatingInput label="Rating input" defaultValue={3} max={5} />
                    <TagInput label="Tag input" defaultValue={["example"]} />
                    <PinInput label="Pin input" length={6} />
                </div>
            </LabSection>
            <LabSection title="Color, file, and validation">
                <div className="grid gap-5 sm:grid-cols-2">
                    <ColorPicker label="Color picker" defaultValue="#00DC82" />
                    <FileUpload label="File upload" accept=".pdf,.png" />
                    <ValidationSummary
                        items={[
                            { field: "displayName", message: "Enter a display name." },
                            { field: "email", message: "Enter an email address." },
                        ]}
                    />
                    <FieldGroup
                        legend="Field group"
                        description="Groups related fields with one legend."
                        errors={["Review the highlighted field."]}
                    >
                        <Field label="Grouped input">{(props) => <Input {...props} />}</Field>
                        <Field label="Grouped input">{(props) => <Input {...props} />}</Field>
                    </FieldGroup>
                </div>
            </LabSection>
            <LabSection title="Multi-step form">
                <MultiStepForm
                    steps={[
                        {
                            id: "one",
                            title: "First step",
                            description: "Short description.",
                            content: <p className="text-sm text-ink-muted">Step one content.</p>,
                        },
                        {
                            id: "two",
                            title: "Second step",
                            description: "Short description.",
                            content: <p className="text-sm text-ink-muted">Step two content.</p>,
                        },
                    ]}
                />
            </LabSection>
        </div>
    );
}

interface LabTableRow {
    readonly id: string;
    readonly name: string;
    readonly status: string;
}

const LAB_ROWS: readonly LabTableRow[] = [
    { id: "row-1", name: "Example one", status: "Active" },
    { id: "row-2", name: "Example two", status: "Pending" },
];

const LAB_COLUMNS: DataTableColumn<LabTableRow>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "status", header: "Status" },
];

function TreeDemo(): ReactNode {
    const [selectedId, setSelectedId] = useState<string | null>("child-one");
    return (
        <TreeView
            label="Tree view"
            nodes={[
                {
                    id: "parent",
                    label: "Parent node",
                    children: [
                        { id: "child-one", label: "Child one" },
                        { id: "child-two", label: "Child two" },
                    ],
                },
                { id: "second-parent", label: "Second parent" },
            ]}
            selectedId={selectedId}
            onSelect={setSelectedId}
            defaultExpandedIds={["parent"]}
        />
    );
}

function PaginationDemo(): ReactNode {
    const [page, setPage] = useState(1);
    return (
        <div className="flex flex-col gap-4">
            <Pagination page={page} pageCount={4} onPageChange={setPage} />
            <PaginationControls
                canNext={page < 4}
                canPrevious={page > 1}
                onNext={() => setPage((current) => Math.min(current + 1, 4))}
                onPrevious={() => setPage((current) => Math.max(current - 1, 1))}
            />
        </div>
    );
}

function DataGroup(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <GroupIntro
                title="D. Data"
                description="Tables, timelines, feeds, charts, and collection displays."
                keyboard="Sortable table headers are buttons. Tree view supports arrows, Home, End, Enter, and Space."
                accessibility="Tables have header cells. Charts expose a text summary and a data table."
            />
            <LabSection title="Table">
                <Table>
                    <TableCaption>Neutral table fixture.</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Owner</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell>Example one</TableCell>
                            <TableCell>Active</TableCell>
                            <TableCell>Example owner</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>Example two</TableCell>
                            <TableCell>Pending</TableCell>
                            <TableCell>Example owner</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </LabSection>
            <LabSection title="Data table">
                <DataTable
                    label="Data table example"
                    columns={LAB_COLUMNS}
                    data={LAB_ROWS}
                    getRowId={(row) => row.id}
                />
            </LabSection>
            <LabSection title="Accordion and scroll area">
                <div className="grid gap-6 sm:grid-cols-2">
                    <Accordion type="single" collapsible defaultValue="one">
                        <AccordionItem value="one">
                            <AccordionTrigger>First section</AccordionTrigger>
                            <AccordionContent>First section content.</AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="two">
                            <AccordionTrigger>Second section</AccordionTrigger>
                            <AccordionContent>Second section content.</AccordionContent>
                        </AccordionItem>
                    </Accordion>
                    <ScrollArea className="h-32 rounded-md border border-line">
                        <div className="flex flex-col gap-2 p-3">
                            {Array.from({ length: 10 }, (_, index) => (
                                <p key={index} className="text-sm text-ink-muted">
                                    Scrollable row {String(index + 1)}
                                </p>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </LabSection>
            <LabSection title="Key-value, statistics, and file list">
                <div className="grid gap-6 sm:grid-cols-2">
                    <KeyValue
                        items={[
                            { label: "Example key", value: "Example value" },
                            { label: "Second key", value: "Second value" },
                        ]}
                    />
                    <Statistics
                        columns={2}
                        items={[
                            { label: "Example metric", value: "42" },
                            { label: "Example ratio", value: "18%" },
                        ]}
                    />
                    <FileList
                        items={[
                            {
                                id: "file-1",
                                name: "example.txt",
                                size: 1024,
                                type: "text/plain",
                                status: { label: "Approved", tone: "success" },
                            },
                        ]}
                    />
                </div>
            </LabSection>
            <LabSection title="Timeline, activity feed, and activity timeline">
                <div className="grid gap-6 lg:grid-cols-2">
                    <Timeline
                        events={[
                            {
                                id: "one",
                                time: new Date("2026-01-15T10:00:00Z"),
                                title: "Example event",
                                description: "Neutral timeline fixture.",
                                status: { label: "Recorded", tone: "neutral" },
                            },
                        ]}
                    />
                    <ActivityFeed
                        items={[
                            {
                                id: "one",
                                actor: "Example member",
                                action: "updated",
                                target: "an example record",
                                timestamp: new Date("2026-01-15T10:00:00Z"),
                            },
                        ]}
                    />
                    <ActivityTimeline
                        events={[
                            {
                                id: "one",
                                type: "submission",
                                title: "Example submission event",
                                timestamp: new Date("2026-01-15T10:00:00Z"),
                                actor: "Example member",
                            },
                        ]}
                    />
                </div>
            </LabSection>
            <LabSection title="Charts">
                <div className="grid gap-6 lg:grid-cols-2">
                    <Chart
                        variant="bar"
                        title="Bar chart"
                        data={[
                            { label: "One", value: 3 },
                            { label: "Two", value: 5 },
                            { label: "Three", value: 2 },
                        ]}
                        valueLabel="Example count"
                    />
                    <Chart
                        variant="line"
                        title="Line chart"
                        data={[
                            { label: "One", value: 1 },
                            { label: "Two", value: 4 },
                            { label: "Three", value: 3 },
                        ]}
                        valueLabel="Example count"
                    />
                </div>
            </LabSection>
            <LabSection title="Carousel and tree view">
                <div className="grid gap-6 sm:grid-cols-2">
                    <Carousel
                        label="Carousel example"
                        slides={[
                            {
                                id: "one",
                                label: "Slide one",
                                content: <p className="text-sm">Content one</p>,
                            },
                            {
                                id: "two",
                                label: "Slide two",
                                content: <p className="text-sm">Content two</p>,
                            },
                        ]}
                    />
                    <TreeDemo />
                </div>
            </LabSection>
            <LabSection title="Pagination">
                <PaginationDemo />
            </LabSection>
        </div>
    );
}

function CommandPaletteDemo(): ReactNode {
    const [open, setOpen] = useState(false);
    return (
        <>
            <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={() => setOpen(true)}>
                    Open command palette
                </Button>
                <span className="text-xs text-ink-muted">Ctrl K also opens the palette.</span>
            </div>
            <CommandPalette
                open={open}
                onOpenChange={setOpen}
                groups={[
                    {
                        heading: "Example",
                        items: [
                            {
                                id: "one",
                                label: "Example command",
                                description: "Neutral command fixture.",
                                onSelect: () => setOpen(false),
                            },
                        ],
                    },
                ]}
            />
        </>
    );
}

function NavigationGroup(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <GroupIntro
                title="E. Navigation"
                description="Breadcrumbs, tabs, menus, steppers, and contextual navigation."
                keyboard="Menus navigate with arrows. Tabs use arrows, Home, and End. The command palette opens with Ctrl K."
                accessibility="Navigation landmarks are labeled. The current page is marked with aria-current."
            />
            <LabSection title="Breadcrumb and link">
                <div className="flex flex-col gap-4">
                    <Breadcrumb
                        items={[
                            { label: "Home", href: "#" },
                            { label: "Section", href: "#" },
                            { label: "Current page" },
                        ]}
                    />
                    <div className="flex gap-4">
                        <Link href="#" active>
                            Active link
                        </Link>
                        <Link href="#">Inactive link</Link>
                    </div>
                </div>
            </LabSection>
            <LabSection title="Tabs">
                <Tabs defaultValue="one">
                    <TabsList>
                        <TabsTrigger value="one">First tab</TabsTrigger>
                        <TabsTrigger value="two">Second tab</TabsTrigger>
                        <TabsTrigger value="three" disabled>
                            Disabled tab
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="one">First tab content.</TabsContent>
                    <TabsContent value="two">Second tab content.</TabsContent>
                </Tabs>
            </LabSection>
            <LabSection title="Stepper">
                <Stepper
                    current={1}
                    steps={[
                        { id: "one", title: "First step", description: "Completed" },
                        { id: "two", title: "Second step", description: "Current" },
                        { id: "three", title: "Third step" },
                    ]}
                />
            </LabSection>
            <LabSection title="Navigation menu and footer columns">
                <div className="flex flex-col gap-8">
                    <NavigationMenu
                        items={[
                            { id: "one", label: "Direct link", href: "#" },
                            {
                                id: "two",
                                label: "Group",
                                items: [
                                    { id: "two-a", label: "Group link one", href: "#" },
                                    { id: "two-b", label: "Group link two", href: "#" },
                                ],
                            },
                        ]}
                    />
                    <FooterColumns
                        brand={<span className="text-sm font-semibold">nethack</span>}
                        columns={[
                            {
                                id: "product",
                                title: "Product",
                                links: [{ label: "Example link", href: "#" }],
                            },
                        ]}
                        legal="Neutral footer fixture."
                    />
                </div>
            </LabSection>
            <LabSection title="Contextual navigation, search navigation, and sidebar navigation">
                <div className="grid gap-6 lg:grid-cols-3">
                    <ContextualNavigation
                        title="Contextual"
                        items={[
                            { id: "one", label: "First item", active: true },
                            { id: "two", label: "Second item" },
                        ]}
                    />
                    <SearchNavigation
                        label="Search navigation"
                        items={[
                            { id: "one", label: "Example result", href: "#" },
                            { id: "two", label: "Another result", href: "#" },
                        ]}
                    />
                    <SidebarNavigation
                        sections={[
                            {
                                id: "one",
                                title: "Section",
                                items: [
                                    { id: "one-a", label: "First item", active: true },
                                    { id: "one-b", label: "Second item" },
                                ],
                            },
                        ]}
                    />
                </div>
            </LabSection>
            <LabSection title="Command palette">
                <CommandPaletteDemo />
            </LabSection>
        </div>
    );
}

function AlertDialogDemo(): ReactNode {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button variant="outline" onClick={() => setOpen(true)}>
                Open alert dialog
            </Button>
            <AlertDialog
                open={open}
                onOpenChange={setOpen}
                title="Confirm action"
                description="This dialog requires an explicit decision before continuing."
                confirmLabel="Confirm"
                onConfirm={() => setOpen(false)}
            />
        </>
    );
}

function ConfirmDialogDemo(): ReactNode {
    const [open, setOpen] = useState(false);
    return (
        <>
            <Button variant="outline" onClick={() => setOpen(true)}>
                Open confirm dialog
            </Button>
            <ConfirmDialog
                open={open}
                onOpenChange={setOpen}
                title="Confirm action"
                description="Confirmation dialog with a footer action."
                confirmLabel="Confirm"
                onConfirm={() => setOpen(false)}
            />
        </>
    );
}

function SuggestionMenuDemo(): ReactNode {
    const [open, setOpen] = useState(false);
    return (
        <EditorSuggestionMenu
            open={open}
            onOpenChange={setOpen}
            anchor={
                <Button type="button" variant="outline" onClick={() => setOpen(true)}>
                    Open suggestion menu
                </Button>
            }
            suggestions={[
                { id: "one", label: "Suggestion one", description: "Neutral fixture." },
                { id: "two", label: "Suggestion two" },
            ]}
            onSelect={() => setOpen(false)}
        />
    );
}

function MentionMenuDemo(): ReactNode {
    const [open, setOpen] = useState(false);
    return (
        <EditorMentionMenu
            open={open}
            onOpenChange={setOpen}
            anchor={
                <Button type="button" variant="outline" onClick={() => setOpen(true)}>
                    Open mention menu
                </Button>
            }
            mentions={[
                { id: "one", name: "example", detail: "Example member" },
                { id: "two", name: "second", detail: "Example member" },
            ]}
            onSelect={() => setOpen(false)}
        />
    );
}

function OverlaysGroup(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <GroupIntro
                title="F. Overlays"
                description="Dialogs, drawers, menus, popovers, tooltips, and toasts."
                keyboard="Escape closes overlays. Focus is trapped while open and returns to the trigger on close."
                accessibility="Dialogs have a title and description. Menus expose roles and focus states."
            />
            <LabSection title="Dialog and alert dialog">
                <div className="flex flex-wrap gap-2">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline">Open dialog</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Dialog title</DialogTitle>
                                <DialogDescription>
                                    Dialog description describing the task.
                                </DialogDescription>
                            </DialogHeader>
                            <p className="text-sm text-ink-muted">Dialog body content.</p>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="outline">Close</Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <AlertDialogDemo />
                    <ConfirmDialogDemo />
                </div>
            </LabSection>
            <LabSection title="Drawer and slideover">
                <div className="flex flex-wrap gap-2">
                    <Drawer>
                        <DrawerTrigger asChild>
                            <Button variant="outline">Open drawer</Button>
                        </DrawerTrigger>
                        <DrawerContent
                            title="Drawer title"
                            description="Drawer description."
                            side="right"
                        >
                            Drawer content.
                        </DrawerContent>
                    </Drawer>
                    <Slideover>
                        <SlideoverTrigger asChild>
                            <Button variant="outline">Open slideover</Button>
                        </SlideoverTrigger>
                        <SlideoverContent
                            title="Slideover title"
                            description="Slideover description."
                        >
                            Slideover content.
                        </SlideoverContent>
                    </Slideover>
                </div>
            </LabSection>
            <LabSection title="Dropdown, context menu, and popover">
                <div className="flex flex-wrap items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">Open menu</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuLabel>Example menu</DropdownMenuLabel>
                            <DropdownMenuItem>First item</DropdownMenuItem>
                            <DropdownMenuItem>Second item</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem destructive>Destructive item</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <ContextMenu>
                        <ContextMenuTrigger asChild>
                            <div className="rounded-md border border-dashed border-line p-4 text-sm text-ink-muted">
                                Right-click this area
                            </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                            <ContextMenuLabel>Context menu</ContextMenuLabel>
                            <ContextMenuItem>First item</ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem shortcut="Del">Second item</ContextMenuItem>
                        </ContextMenuContent>
                    </ContextMenu>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline">Open popover</Button>
                        </PopoverTrigger>
                        <PopoverContent>
                            <p className="text-sm text-ink-muted">Popover content.</p>
                        </PopoverContent>
                    </Popover>
                </div>
            </LabSection>
            <LabSection title="Tooltip and hover card">
                <div className="flex flex-wrap items-center gap-4">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline">Hover or focus</Button>
                        </TooltipTrigger>
                        <TooltipContent>Tooltip content</TooltipContent>
                    </Tooltip>
                    <HoverCard>
                        <HoverCardTrigger asChild>
                            <Button variant="link">Open hover card</Button>
                        </HoverCardTrigger>
                        <HoverCardContent>
                            <p className="text-sm text-ink-muted">Hover card content.</p>
                        </HoverCardContent>
                    </HoverCard>
                </div>
            </LabSection>
            <LabSection title="Toast (rendered by the provider)">
                <p className="text-sm text-ink-muted">
                    Use the toast example in the basic elements group. The provider owns the
                    viewport.
                </p>
            </LabSection>
        </div>
    );
}

function DashboardGroupLab(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <GroupIntro
                title="G. Dashboard"
                description="Dashboard shell, sidebar, toolbar, search, panels, and resize handle."
                keyboard="Sidebar resize handle uses arrows, Home, and End. The sidebar toggle is a button."
                accessibility="The sidebar is a labeled complementary landmark. Mobile sidebar traps focus and closes with Escape."
            />
            <LabSection title="Dashboard group">
                <DashboardGroup className="min-h-0 overflow-hidden rounded-md border border-line">
                    <DashboardNavbar>
                        <DashboardSidebarToggle />
                        <span className="text-sm font-semibold">Dashboard</span>
                        <div className="ml-auto">
                            <DashboardSearchButton label="Search" shortcut="Ctrl K" />
                        </div>
                    </DashboardNavbar>
                    <div className="flex min-h-64">
                        <DashboardSidebar label="Dashboard sidebar">
                            <div className="flex items-center justify-between gap-2 p-3">
                                <span className="text-sm text-ink-muted">Sidebar</span>
                                <DashboardSidebarCollapse />
                            </div>
                            <nav className="flex flex-col gap-1 p-3" aria-label="Example dashboard">
                                <a
                                    href="#lab-dashboard-link-target"
                                    className="rounded-sm px-2 py-1.5 text-sm text-ink-muted hover:bg-raised"
                                >
                                    First link
                                </a>
                                <a
                                    href="#lab-dashboard-link-target"
                                    className="rounded-sm px-2 py-1.5 text-sm text-ink-muted hover:bg-raised"
                                >
                                    Second link
                                </a>
                            </nav>
                        </DashboardSidebar>
                        <DashboardResizeHandle />
                        <div className="flex min-w-0 flex-1 flex-col">
                            <DashboardToolbar>
                                <DashboardSearch label="Dashboard search" shortcut="Ctrl K" />
                            </DashboardToolbar>
                            <div className="p-4">
                                <DashboardPanel>
                                    <div
                                        id="lab-dashboard-link-target"
                                        className="p-4 text-sm text-ink-muted"
                                    >
                                        Dashboard panel content.
                                    </div>
                                </DashboardPanel>
                            </div>
                        </div>
                    </div>
                </DashboardGroup>
            </LabSection>
        </div>
    );
}

function PageGroup(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <GroupIntro
                title="H. Page composition"
                description="Marketing and documentation page composition primitives."
                keyboard="Links are keyboard operable. The table of contents updates as headings enter the viewport."
                accessibility="Headings keep a logical hierarchy. Anchors have visible focus states."
            />
            <LabSection title="Page hero and sections">
                <Page className="gap-8">
                    <PageHero
                        title="Page hero"
                        description="Hero description for a composed page."
                        actions={<Button>Primary action</Button>}
                    />
                    <PageSection title="Page section" description="Section description.">
                        <Card>
                            <CardContent>Section content.</CardContent>
                        </Card>
                    </PageSection>
                </Page>
            </LabSection>
            <LabSection title="Features, grid, and columns">
                <div className="flex flex-col gap-6">
                    <PageFeatures
                        features={[
                            {
                                id: "one",
                                title: "Feature one",
                                description: "Feature description.",
                                icon: <Check className="size-5" />,
                            },
                            {
                                id: "two",
                                title: "Feature two",
                                description: "Feature description.",
                                icon: <Plus className="size-5" />,
                            },
                        ]}
                    />
                    <PageGrid cols={2}>
                        <PageCard title="Page card one" description="Card description." />
                        <PageCard title="Page card two" description="Card description." />
                    </PageGrid>
                    <PageColumns columns={2}>
                        <PageFeature title="Column one" description="Feature description." />
                        <PageFeature title="Column two" description="Feature description." />
                    </PageColumns>
                </div>
            </LabSection>
            <LabSection title="Links, list, logos, and call to action">
                <div className="flex flex-col gap-6">
                    <PageLinks
                        links={[
                            {
                                id: "one",
                                label: "Example link",
                                href: "#",
                                description: "Description.",
                            },
                        ]}
                    />
                    <PageList
                        items={[{ id: "one", label: "Example item", description: "Description." }]}
                    />
                    <PageLogos logos={[{ id: "one", name: "Example logo" }]} />
                    <PageCta
                        title="Call to action"
                        description="Composed call to action."
                        actions={<Button>Action</Button>}
                    />
                </div>
            </LabSection>
            <LabSection title="Content navigation and search">
                <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
                    <ContentNavigation
                        items={[
                            { id: "one", label: "First section", active: true },
                            { id: "two", label: "Second section" },
                        ]}
                    />
                    <ContentSearch
                        items={[
                            { id: "one", label: "Example page", href: "#" },
                            { id: "two", label: "Another page", href: "#" },
                        ]}
                    />
                </div>
            </LabSection>
            <LabSection title="Table of contents and content pagination">
                <div className="flex flex-col gap-6 sm:flex-row">
                    <TableOfContents
                        items={[
                            { id: "lab-toc-one", label: "First heading" },
                            { id: "lab-toc-two", label: "Second heading", level: 3 },
                        ]}
                    />
                    <div className="flex flex-col gap-6">
                        <h3 id="lab-toc-one" className="text-base font-semibold">
                            First heading
                        </h3>
                        <p className="text-sm text-ink-muted">Example content.</p>
                        <h4 id="lab-toc-two" className="text-sm font-semibold">
                            Second heading
                        </h4>
                        <p className="text-sm text-ink-muted">Example content.</p>
                    </div>
                </div>
                <ContentPagination
                    previous={{ label: "Previous page", href: "#" }}
                    next={{ label: "Next page", href: "#" }}
                />
            </LabSection>
        </div>
    );
}

function AdvancedGroup(): ReactNode {
    return (
        <div className="flex flex-col gap-6">
            <GroupIntro
                title="I. Advanced"
                description="Editors, scheduling, resizable panels, search, previews, review panels, and rubrics."
                keyboard="Toolbars use arrows, Home, and End. Resizable panels use arrow keys on the separator."
                accessibility="Editors keep a labeled textarea. Rubrics announce the weighted total with aria-live."
            />
            <LabSection title="Rich text editor and toolbar">
                <RichTextDemo />
            </LabSection>
            <LabSection title="Editor toolbar, drag handle, and suggestion menus">
                <div className="flex flex-col gap-4">
                    <EditorToolbar
                        actions={[
                            {
                                id: "one",
                                label: "Example action",
                                icon: <Check className="size-4" />,
                                onSelect: () => undefined,
                                pressed: true,
                            },
                            {
                                id: "two",
                                label: "Second action",
                                icon: <Plus className="size-4" />,
                                onSelect: () => undefined,
                            },
                        ]}
                    />
                    <div className="flex items-center gap-2">
                        <EditorDragHandle label="Reorder example item" />
                        <span className="text-sm text-ink-muted">Draggable row fixture.</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <SuggestionMenuDemo />
                        <MentionMenuDemo />
                    </div>
                </div>
            </LabSection>
            <LabSection title="Charts">
                <div className="grid gap-6 lg:grid-cols-2">
                    <BarChart
                        title="Bar chart"
                        data={[
                            { label: "One", value: 2 },
                            { label: "Two", value: 4 },
                        ]}
                        valueLabel="Example count"
                    />
                    <LineChart
                        title="Line chart"
                        data={[
                            { label: "One", value: 1 },
                            { label: "Two", value: 3 },
                        ]}
                        valueLabel="Example count"
                    />
                </div>
            </LabSection>
            <LabSection title="Calendar views">
                <CalendarViewsDemo />
            </LabSection>
            <LabSection title="Resizable panels">
                <ResizablePanelsDemo />
            </LabSection>
            <LabSection title="Advanced search">
                <AdvancedSearchDemo />
            </LabSection>
            <LabSection title="File preview">
                <FilePreview
                    name="example.txt"
                    kind="text"
                    mimeType="text/plain"
                    size={1024}
                    text={"Example text content for the preview component."}
                />
            </LabSection>
            <LabSection title="Evaluation rubric">
                <RubricDemo />
            </LabSection>
            <LabSection title="Submission review panel">
                <SubmissionReviewPanel
                    title="Example submission"
                    description="Neutral review fixture."
                    summary={<p className="text-sm text-ink-muted">Summary content.</p>}
                    decisions={[
                        { id: "accept", label: "Accept" },
                        { id: "reject", label: "Reject", tone: "critical" },
                    ]}
                    onDecision={() => undefined}
                    confirmation={{
                        title: "Confirm decision",
                        description: "This records the review decision.",
                        confirmLabel: "Confirm",
                    }}
                />
            </LabSection>
            <LabSection title="Activity timeline">
                <ActivityTimeline
                    events={[
                        {
                            id: "one",
                            type: "review",
                            title: "Example review event",
                            description: "Neutral event fixture.",
                            timestamp: new Date("2026-01-15T10:00:00Z"),
                            actor: "Example member",
                        },
                    ]}
                />
            </LabSection>
        </div>
    );
}

function RichTextDemo(): ReactNode {
    const [value, setValue] = useState(FORM_EXAMPLE);
    return <RichTextEditor label="Rich text editor" value={value} onChange={setValue} />;
}

function CalendarViewsDemo(): ReactNode {
    const [date, setDate] = useState(new Date("2026-01-15T12:00:00Z"));
    const [focusedDate, setFocusedDate] = useState(new Date("2026-01-15T12:00:00Z"));
    return (
        <CalendarViews
            date={date}
            onDateChange={setDate}
            focusedDate={focusedDate}
            onFocusedDateChange={setFocusedDate}
            events={[
                {
                    id: "one",
                    title: "Example event",
                    start: new Date("2026-01-15T10:00:00Z"),
                },
            ]}
        />
    );
}

function ResizablePanelsDemo(): ReactNode {
    const [sizes, setSizes] = useState<number[]>([50, 50]);
    return (
        <ResizablePanels
            panels={[
                {
                    id: "one",
                    label: "First panel",
                    content: <div className="p-3 text-sm">First panel</div>,
                },
                {
                    id: "two",
                    label: "Second panel",
                    content: <div className="p-3 text-sm">Second panel</div>,
                },
            ]}
            sizes={sizes}
            onSizesChange={setSizes}
            minSizes={[20, 20]}
        />
    );
}

function AdvancedSearchDemo(): ReactNode {
    const [value, setValue] = useState<{
        query: string;
        filters: Readonly<Record<string, string | boolean | undefined>>;
    }>({ query: "", filters: {} });
    return (
        <AdvancedSearch
            value={value}
            onChange={setValue}
            filters={[
                {
                    id: "status",
                    label: "Status",
                    type: "select",
                    options: [
                        { value: "one", label: "Option one" },
                        { value: "two", label: "Option two" },
                    ],
                },
                { id: "active", label: "Active only", type: "toggle" },
            ]}
        />
    );
}

function RubricDemo(): ReactNode {
    const [scores, setScores] = useState<Record<string, { score: number; comment?: string }>>({
        one: { score: 3, comment: "" },
    });
    return (
        <EvaluationRubric
            criteria={[
                { id: "one", label: "Criterion one", maxScore: 5, weight: 2 },
                {
                    id: "two",
                    label: "Criterion two",
                    description: "Example criterion.",
                    maxScore: 10,
                },
            ]}
            scores={scores}
            onChange={setScores}
        />
    );
}
