import { useEffect, useState } from 'react'
import { ccc } from '@ckb-ccc/ccc'
import { useCcc, useSigner } from '@ckb-ccc/connector-react'
import './App.css'

function App() {
  const { open, disconnect, wallet } = useCcc()
  const signer = useSigner()

  const [network, setNetwork] = useState('Loading...')
  const [address, setAddress] = useState('Not connected')
  const [balance, setBalance] = useState('--')

  const [queryAddress, setQueryAddress] = useState('')

  const [queriedBalance, setQueriedBalance] =
    useState<string | null>(null)

  const [queryStatus, setQueryStatus] = useState('')
  const [isQuerying, setIsQuerying] = useState(false)

  const [cells, setCells] = useState<any[]>([])
  const [cellsStatus, setCellsStatus] = useState('')
  const [isQueryingCells, setIsQueryingCells] =
    useState(false)

  const [transactions, setTransactions] =
    useState<any[]>([])

  const [txStatus, setTxStatus] = useState('')
  const [isQueryingTx, setIsQueryingTx] =
    useState(false)

  useEffect(() => {
    const client = new ccc.ClientPublicTestnet()

    setNetwork(
      client.addressPrefix === 'ckt'
        ? 'CKB Testnet'
        : 'Unknown',
    )
  }, [])

  useEffect(() => {
    async function loadWalletInfo() {
      if (!signer) {
        setAddress('Not connected')
        setBalance('--')
        return
      }

      const addr =
        await signer.getRecommendedAddress()

      setAddress(addr)

      const balanceValue =
        await signer.getBalance()

      setBalance(
        ccc.fixedPointToString(balanceValue),
      )
    }

    loadWalletInfo()
  }, [signer])

  async function handleQueryBalance() {
    setQueryStatus('')
    setQueriedBalance(null)

    if (!queryAddress.trim()) {
      setQueryStatus(
        'Please enter a CKB Testnet address.',
      )
      return
    }

    try {
      setIsQuerying(true)

      const client =
        new ccc.ClientPublicTestnet()

      const { script: lock } =
        await ccc.Address.fromString(
          queryAddress.trim(),
          client,
        )

      const balanceValue =
        await client.getBalance([lock])

      setQueriedBalance(
        ccc.fixedPointToString(balanceValue),
      )
    } catch (error) {
      setQueryStatus(
        error instanceof Error
          ? error.message
          : String(error),
      )
    } finally {
      setIsQuerying(false)
    }
  }

  async function handleQueryCells() {
    setCells([])
    setCellsStatus('')

    if (!queryAddress.trim()) {
      setCellsStatus(
        'Please enter a CKB Testnet address.',
      )
      return
    }

    try {
      setIsQueryingCells(true)

      const client =
        new ccc.ClientPublicTestnet()

      const { script: lock } =
        await ccc.Address.fromString(
          queryAddress.trim(),
          client,
        )

      const result: any[] = []

      for await (
        const cell of client.findCellsByLock(lock)
      ) {
        result.push(cell)

        if (result.length >= 10) {
          break
        }
      }

      setCells(result)

      if (result.length === 0) {
        setCellsStatus(
          'No live cells found.',
        )
      }
    } catch (error) {
      setCellsStatus(
        error instanceof Error
          ? error.message
          : String(error),
      )
    } finally {
      setIsQueryingCells(false)
    }
  }

  async function handleQueryTransactions() {
    setTransactions([])
    setTxStatus('')

    if (!queryAddress.trim()) {
      setTxStatus(
        'Please enter a CKB Testnet address.',
      )
      return
    }

    try {
      setIsQueryingTx(true)

      const client =
        new ccc.ClientPublicTestnet()

      const { script: lock } =
        await ccc.Address.fromString(
          queryAddress.trim(),
          client,
        )

      const result: any[] = []

      for await (
        const tx of client.findTransactionsByLock(
          lock,
          null,
          true,
        )
      ) {
        result.push(tx)

        if (result.length >= 10) {
          break
        }
      }

      setTransactions(result)

      if (result.length === 0) {
        setTxStatus(
          'No transactions found.',
        )
      }
    } catch (error) {
      setTxStatus(
        error instanceof Error
          ? error.message
          : String(error),
      )
    } finally {
      setIsQueryingTx(false)
    }
  }

  return (
    <main>
      <h1>CKB Learning dApp</h1>

      <section>
        <h2>Wallet Info</h2>

        <p>
          <strong>Network:</strong>{' '}
          {network}
        </p>

        <p>
          <strong>Wallet:</strong>{' '}
          {wallet
            ? wallet.name
            : 'Not connected'}
        </p>

        <p>
          <strong>Address:</strong>
          <br />
          <code>{address}</code>
        </p>

        <p>
          <strong>Balance:</strong>
          <br />
          <strong>
            {balance} CKB
          </strong>
        </p>

        {!wallet ? (
          <button onClick={open}>
            Connect Wallet
          </button>
        ) : (
          <button onClick={disconnect}>
            Disconnect
          </button>
        )}
      </section>

      <hr />

      <section>
        <h2>
          Query Testnet Address
        </h2>

        <input
          type="text"
          value={queryAddress}
          onChange={(e) =>
            setQueryAddress(
              e.target.value,
            )
          }
          placeholder="ckt1..."
        />

        <button
          onClick={
            handleQueryBalance
          }
          disabled={isQuerying}
        >
          {isQuerying
            ? 'Querying...'
            : 'Query Balance'}
        </button>

        <button
          onClick={
            handleQueryCells
          }
          disabled={
            isQueryingCells
          }
        >
          {isQueryingCells
            ? 'Querying Cells...'
            : 'Query Cells'}
        </button>

        <button
          onClick={
            handleQueryTransactions
          }
          disabled={
            isQueryingTx
          }
        >
          {isQueryingTx
            ? 'Querying Transactions...'
            : 'Query Transactions'}
        </button>

        {queriedBalance !== null && (
          <p>
            Balance:{' '}
            {queriedBalance} CKB
          </p>
        )}

        {queryStatus && (
          <p>{queryStatus}</p>
        )}

        {cellsStatus && (
          <p>{cellsStatus}</p>
        )}

        {txStatus && (
          <p>{txStatus}</p>
        )}
      </section>

      <hr />

      <section>
        <h2>Live Cells</h2>

        {cells.length > 0 && (
          <div>
            {cells.map(
              (cell, index) => (
                <div key={index}>
                  <p>
                    <strong>
                      Cell #{index + 1}
                    </strong>
                  </p>

                  <p>
                    Capacity:{' '}
                    {ccc.fixedPointToString(
                      cell.cellOutput
                        .capacity,
                    )}{' '}
                    CKB
                  </p>

                  <p>
                    Tx Hash:
                    <br />
                    <code>
                      {
                        cell.outPoint
                          .txHash
                      }
                    </code>
                  </p>

                  <p>
                    Index:{' '}
                    {
                      cell.outPoint
                        .index
                        .toString()
                    }
                  </p>

                  <hr />
                </div>
              ),
            )}
          </div>
        )}
      </section>

      <hr />

      <section>
        <h2>Transactions</h2>

        {transactions.length > 0 && (
          <div>
            {transactions.map(
              (tx, index) => (
                <div key={index}>
                  <p>
                    <strong>
                      Transaction #
                      {index + 1}
                    </strong>
                  </p>

                  <p>
                    Tx Hash:
                    <br />
                    <code>
                      {tx.txHash}
                    </code>
                  </p>

                  <p>
                    Block:{' '}
                    {
                      tx.blockNumber
                        .toString()
                    }
                  </p>

                  <hr />
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </main>
  )
}

export default App