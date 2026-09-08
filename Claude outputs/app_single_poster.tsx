import { addPage } from "@canva/design";
import { Button, Rows, Text } from "@canva/app-ui-kit";
import { useState } from "react";
import "@canva/app-ui-kit/styles.css";

/**
 * ポスター自動生成アプリ(お試し版・1件のみ)
 *
 * data/entries.json の中から1件(身体障害者手帳の交付申請)をサンプルとして
 * ハードコードし、Canva本体の「ページ追加」機能(addPage)でネイティブの
 * テキスト要素として1枚のポスターページを生成します。
 *
 * まずはこの1件で見た目を確認し、フィードバックをもらいながら
 * レイアウト(位置・文字サイズ・色・表示する項目)を調整していきます。
 * 良い形が決まったら、entries.json 全件をループする版に拡張します。
 */

const sampleEntry = {
  id: "e1",
  name: "身体障害者手帳の交付申請",
  type: "制度・手帳",
  target: "身体に障害のある方(等級は障害の程度により区が判定)",
  overview:
    "手帳の交付を受けると、医療費助成や各種福祉サービスの利用、税の控除など様々な支援の対象になります。",
  procedure:
    "①区役所(福祉課)の窓口で申請書を受け取る\n②指定医による診断書・意見書を用意する\n③申請書類一式を区役所に提出する\n④審査後、手帳が交付される",
  contact: "お住まいの区の区役所 福祉課",
};

const PAGE_WIDTH = 1000;
const PAGE_HEIGHT = 1414;

export const App = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const generateOne = async () => {
    setLoading(true);
    setStatus("生成中...");
    try {
      await addPage({
        title: sampleEntry.name,
        dimensions: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
        background: { color: "#EAF3FB" },
        elements: [
          {
            // カテゴリバッジ
            type: "text",
            children: [sampleEntry.type],
            top: 60,
            left: 60,
            width: 300,
            fontSize: 28,
            color: "#1A5DAB",
            fontWeight: "bold",
          },
          {
            // タイトル
            type: "text",
            children: [sampleEntry.name],
            top: 110,
            left: 60,
            width: 880,
            fontSize: 56,
            fontWeight: "bold",
          },
          {
            // 対象
            type: "text",
            children: [`対象: ${sampleEntry.target}`],
            top: 280,
            left: 60,
            width: 880,
            fontSize: 28,
          },
          {
            // 概要
            type: "text",
            children: [sampleEntry.overview],
            top: 400,
            left: 60,
            width: 880,
            fontSize: 30,
          },
          {
            // 手続き
            type: "text",
            children: [sampleEntry.procedure],
            top: 620,
            left: 60,
            width: 880,
            fontSize: 26,
          },
          {
            // 連絡先(下部)
            type: "text",
            children: [`問い合わせ: ${sampleEntry.contact}`],
            top: 1280,
            left: 60,
            width: 880,
            fontSize: 30,
            fontWeight: "bold",
            color: "#1A5DAB",
          },
        ],
      });
      setStatus("生成しました。ページ一覧の最後に追加されています。");
    } catch (err) {
      console.error(err);
      setStatus("エラーが発生しました。ブラウザのコンソールを確認してください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Rows spacing="2u">
      <Text>サンプル1件(身体障害者手帳の交付申請)でポスターを1枚生成します。</Text>
      <Button variant="primary" onClick={generateOne} loading={loading}>
        ポスターを1枚生成
      </Button>
      {status && <Text>{status}</Text>}
    </Rows>
  );
};
