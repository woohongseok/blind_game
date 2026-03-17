import styles from './HomePage.module.css'

export function HomePage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Blind Game</h1>
      <p className={styles.subtitle}>게임을 시작하려면 클릭하세요</p>
    </div>
  )
}
