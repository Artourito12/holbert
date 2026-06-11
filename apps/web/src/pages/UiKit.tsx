import {
  Alert,
  Badge,
  Button,
  Icons,
  Modal,
  PaginationExample,
  ProgressBar,
  SpinnerOne,
  SpinnerTwo,
  SpinnerThree,
  SpinnerFour,
  TabExample,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  TooltipExample,
  useModal,
  useToast,
} from "@holbert/ui";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
        <h2 className="text-base font-medium text-gray-800 dark:text-white/90">
          {title}
        </h2>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

const DEMO_CONTRATS = [
  { nom: "Bail commercial — 12 rue de la Paix", type: "Bail commercial", statut: "Audité", score: 72 },
  { nom: "Prestation dev freelance — ACME", type: "Prestation de services", statut: "En cours", score: 45 },
  { nom: "CGV site e-commerce", type: "CGV", statut: "À auditer", score: 0 },
];

export default function UiKit() {
  const toast = useToast();
  const { isOpen, openModal, closeModal } = useModal();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-title-sm font-semibold text-gray-900 dark:text-white">
          UI Kit
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Design system Heldert, brand bordeaux — page de vérification visuelle
          des composants @holbert/ui.
        </p>
      </div>

      <div className="space-y-6">
        <Section title="Boutons">
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm">Primaire sm</Button>
            <Button size="md">Primaire md</Button>
            <Button variant="outline">Outline</Button>
            <Button disabled>Désactivé</Button>
            <Button startIcon={<Icons.PlusIcon className="size-5" />}>
              Avec icône
            </Button>
          </div>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Primaire</Badge>
            <Badge color="success">Succès</Badge>
            <Badge color="error">Erreur</Badge>
            <Badge color="warning">Avertissement</Badge>
            <Badge color="info">Info</Badge>
            <Badge color="light">Neutre</Badge>
            <Badge variant="solid">Primaire solid</Badge>
            <Badge variant="solid" color="success">
              Succès solid
            </Badge>
          </div>
        </Section>

        <Section title="Alertes">
          <div className="space-y-4">
            <Alert
              variant="success"
              title="Document enregistré"
              message="Votre bail commercial a été classé et indexé."
            />
            <Alert
              variant="warning"
              title="Échéance proche"
              message="La tacite reconduction du contrat ACME intervient dans 30 jours."
            />
            <Alert
              variant="error"
              title="Échec de l'analyse"
              message="Le document est illisible. Vérifiez le scan et réessayez."
            />
            <Alert
              variant="info"
              title="Information"
              message="Ce module fournit de l'information juridique, pas du conseil individualisé."
            />
          </div>
        </Section>

        <Section title="Toasts">
          <div className="flex flex-wrap gap-3">
            <Button size="sm" onClick={() => toast.success("Document enregistré")}>
              Succès
            </Button>
            <Button size="sm" onClick={() => toast.error("Erreur de sauvegarde")}>
              Erreur
            </Button>
            <Button size="sm" onClick={() => toast.info("Analyse en cours…")}>
              Info
            </Button>
            <Button
              size="sm"
              onClick={() => toast.warning("Échéance dans 7 jours")}
            >
              Avertissement
            </Button>
          </div>
        </Section>

        <Section title="Modale">
          <Button onClick={openModal}>Ouvrir la modale</Button>
          <Modal isOpen={isOpen} onClose={closeModal} className="max-w-md p-8">
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              Supprimer ce document ?
            </h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Le fichier et son indexation seront supprimés. Cette action est
              irréversible.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={closeModal}>
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  closeModal();
                  toast.success("Document supprimé");
                }}
              >
                Supprimer
              </Button>
            </div>
          </Modal>
        </Section>

        <Section title="Tableau">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200 dark:border-gray-800">
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-left text-theme-xs font-medium uppercase text-gray-400"
                  >
                    Contrat
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-left text-theme-xs font-medium uppercase text-gray-400"
                  >
                    Type
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-left text-theme-xs font-medium uppercase text-gray-400"
                  >
                    Statut
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 text-left text-theme-xs font-medium uppercase text-gray-400"
                  >
                    Score de risque
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DEMO_CONTRATS.map((c) => (
                  <TableRow
                    key={c.nom}
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                  >
                    <TableCell className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {c.nom}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {c.type}
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <Badge
                        size="sm"
                        color={
                          c.statut === "Audité"
                            ? "success"
                            : c.statut === "En cours"
                              ? "warning"
                              : "light"
                        }
                      >
                        {c.statut}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <div className="w-40">
                        <ProgressBar progress={c.score} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>

        <Section title="Chargement">
          <div className="flex flex-wrap items-center gap-8">
            <SpinnerOne />
            <SpinnerTwo />
            <SpinnerThree />
            <SpinnerFour />
          </div>
        </Section>

        <Section title="Icônes (échantillon Heldert)">
          <div className="flex flex-wrap gap-5 text-gray-700 dark:text-gray-300">
            <Icons.PlusIcon className="size-6" />
            <Icons.CloseIcon className="size-6" />
            <Icons.CheckCircleIcon className="size-6" />
            <Icons.AlertIcon className="size-6" />
            <Icons.InfoIcon className="size-6" />
            <Icons.BoltIcon className="size-6" />
            <Icons.FolderIcon className="size-6" />
            <Icons.FileIcon className="size-6" />
            <Icons.DownloadIcon className="size-6" />
            <Icons.PencilIcon className="size-6" />
            <Icons.TrashBinIcon className="size-6" />
            <Icons.GridIcon className="size-6" />
          </div>
        </Section>

        <TabExample />
        <TooltipExample />
        <PaginationExample />
      </div>
    </div>
  );
}
