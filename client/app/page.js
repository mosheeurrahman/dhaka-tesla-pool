import Image from "next/image";
import Nav from "@/components/layout/Nav";
import Button from "@/components/ui/Button";
import Vine from "@/components/motifs/Vine";
import Flower from "@/components/motifs/Flower";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Nav />

      <section className="max-w-4xl mx-auto px-6 pt-8 pb-20 text-center relative">
        <Flower
          className="absolute top-4 left-2 w-8 h-8 opacity-70 hidden md:block"
          color="var(--color-dusk-teal)"
        />
        <Flower
          className="absolute top-16 right-4 w-6 h-6 opacity-70 hidden md:block"
          color="var(--color-rickshaw-red)"
        />

        <div className="relative w-full max-w-md mx-auto aspect-square mb-6">
          <Image
            src="/logo.png"
            alt="Bullet, the Dhaka Tesla Pool rickshaw"
            fill
            priority
            className="object-contain"
          />
        </div>

        <h1 className="font-display text-4xl sm:text-5xl font-bold text-rickshaw-green leading-tight">
          Your Tesla is waiting in Dhaka.
        </h1>

        <div className="my-6 flex justify-center">
          <Vine className="w-48 h-6" color="var(--color-rickshaw-green)" />
        </div>

        <p className="font-body text-lg text-ink/80 max-w-xl mx-auto mb-8">
          Share a seat with Bullet. Split the fare. Skip the traffic stress.
        </p>

        <Button variant="primary" className="text-lg px-8 py-4">
          Find My Tesla
        </Button>
      </section>
    </main>
  );
}