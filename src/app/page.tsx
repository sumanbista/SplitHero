export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl items-center px-6 py-16 sm:px-8">
      <section aria-labelledby="page-title" className="max-w-xl">
        <p className="text-sm font-semibold text-primary">SplitHero</p>
        <h1
          id="page-title"
          className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
        >
          Project foundation ready
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          The application shell is configured. Product flows will be added in
          their dedicated implementation specs.
        </p>
      </section>
    </main>
  );
}
