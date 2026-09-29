# Tirage au sort — Nuit des musées 2026

Tirage au sort du concours de la Nuit des musées 2026 ([conditions de participation](https://lanuitdesmusees.ch/fr_CH/conditions-de-participation)), organisé par l'Association des musées de Lausanne et Pully.

Prix : 5 Passeports Musées Suisses Famille (rangs 1 à 5) et 20 Passeports Musées Suisses Classique (rangs 6 à 25).

## Principe

Le tirage se fait en deux étapes, chacune exécutée par GitHub Actions et publiée dans une release non modifiable.

1. **Gel de la liste** (workflow `Freeze`). Le script lit les participations, applique les règles de [`rules.json`](rules.json) et publie :
   - `data/eligible.json` : les numéros des participations retenues ;
   - `data/excluded.json` : les participations écartées et le motif ;
   - `data/commitment.json` : l'empreinte SHA-256 de ces fichiers et le **numéro du round [drand](https://drand.love)** qui servira au tirage. Ce round est publié plus tard. Au moment du gel, personne ne peut connaître son nombre aléatoire.
2. **Tirage** (workflow `Draw`). Une fois le round publié, le script récupère le nombre aléatoire auprès de plusieurs relais drand et vérifie sa signature. Il calcule ensuite pour chaque participation `sha256("<nombre aléatoire>:<numéro>")` et les classe par ordre croissant. Le classement complet est publié dans `data/result.json`.

Si un gagnant n'est pas éligible ou ne répond pas dans les 7 jours, le prix passe au premier rang suivant non attribué. Il n'y a jamais de second tirage.

Aucune donnée personnelle n'est publiée. Les numéros sont ceux de la base de données des inscriptions, que seul l'organisateur peut relier à une personne.

## Garanties

- La liste est figée avant que le nombre aléatoire existe. Elle ne peut donc pas être ajustée en fonction du résultat.
- drand est un réseau public de hasard, opéré par plusieurs organisations indépendantes (Cloudflare, Protocol Labs, EPFL, etc.). Chaque nombre est signé et vérifiable.
- Le calcul est déterministe. La même liste et le même round donnent toujours le même classement, et n'importe qui peut le recalculer.
- Chaque fichier publié porte une [attestation](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations) signée par GitHub Actions, horodatée dans le registre public Sigstore.

## Vérifier le tirage

Avec Node.js 22 et pnpm :

```sh
git clone https://github.com/WGR-SA/ndm-draw-2026.git
cd ndm-draw-2026
pnpm install
pnpm verify
```

Pour vérifier l'origine d'un fichier :

```sh
gh attestation verify data/result.json --repo WGR-SA/ndm-draw-2026
```

Le round drand peut aussi être consulté directement : `https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/public/<round>`.

## Usage interne

| Commande | Rôle |
|---|---|
| `pnpm preview` | Compte les participations sans rien écrire (nécessite `STRAPI_TOKEN` dans `.env`) |
| Workflow `Freeze` | Gèle la liste. Paramètre : heure du tirage |
| Workflow `Draw` | Tire au sort, après l'heure du round |
| `pnpm reveal --count 35` | Écrit localement `private/winners.csv` (noms, e-mails, photos) pour contacter les gagnants. Jamais publié |
